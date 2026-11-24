import type { Game } from "./types";
import { createClient } from "./supabase/client";
import { cleanGame } from "./text";

/** A user as shown in follow lists and search results. */
export interface PersonRef {
  id: string;
  username: string;
}

export interface ActivityItem {
  userId: string;
  username: string;
  game: Game;
  verb: string;
  rating: number;
  review: string;
  at: number;
}

/** Escape LIKE wildcards so user input can't act as a pattern. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

const NOT_CONFIGURED = "Accounts aren't set up.";

async function profilesByIds(ids: string[]): Promise<PersonRef[]> {
  const sb = createClient();
  if (!sb || ids.length === 0) return [];
  const { data } = await sb.from("profiles").select("id, username").in("id", ids);
  const byId = new Map<string, PersonRef>();
  for (const p of data ?? []) if (p.username) byId.set(p.id, { id: p.id, username: p.username });
  // Keep the order of `ids` (newest follow first).
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

/** People `me` follows, newest first. */
export async function fetchFollowing(me: string): Promise<PersonRef[]> {
  const sb = createClient();
  if (!sb) return [];
  const { data } = await sb
    .from("follows")
    .select("following_id")
    .eq("follower_id", me)
    .order("created_at", { ascending: false });
  return profilesByIds((data ?? []).map((r) => r.following_id as string));
}

/** People who follow `me`, newest first. */
export async function fetchFollowers(me: string): Promise<PersonRef[]> {
  const sb = createClient();
  if (!sb) return [];
  const { data } = await sb
    .from("follows")
    .select("follower_id")
    .eq("following_id", me)
    .order("created_at", { ascending: false });
  return profilesByIds((data ?? []).map((r) => r.follower_id as string));
}

export async function isFollowing(me: string, target: string): Promise<boolean> {
  const sb = createClient();
  if (!sb) return false;
  const { data } = await sb
    .from("follows")
    .select("follower_id")
    .eq("follower_id", me)
    .eq("following_id", target)
    .maybeSingle();
  return Boolean(data);
}

/** Returns an error message, or null on success. */
export async function followUser(me: string, target: string): Promise<string | null> {
  const sb = createClient();
  if (!sb) return NOT_CONFIGURED;
  const { error } = await sb
    .from("follows")
    .upsert({ follower_id: me, following_id: target }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });
  return error ? error.message : null;
}

export async function unfollowUser(me: string, target: string): Promise<string | null> {
  const sb = createClient();
  if (!sb) return NOT_CONFIGURED;
  const { error } = await sb.from("follows").delete().eq("follower_id", me).eq("following_id", target);
  return error ? error.message : null;
}

/** Username search (substring, case-insensitive), excluding yourself. */
export async function searchUsers(query: string, me: string): Promise<PersonRef[]> {
  const sb = createClient();
  const q = query.trim();
  if (!sb || q.length < 2) return [];
  const { data } = await sb
    .from("profiles")
    .select("id, username")
    .ilike("username", `%${escapeLike(q)}%`)
    .neq("id", me)
    .not("username", "is", null)
    .order("username", { ascending: true })
    .limit(10);
  return (data ?? []).flatMap((p) => (p.username ? [{ id: p.id as string, username: p.username as string }] : []));
}

/** Latest shelf/rating/review activity from the people you follow, newest first. */
export async function fetchActivity(following: PersonRef[]): Promise<ActivityItem[]> {
  const sb = createClient();
  if (!sb || following.length === 0) return [];
  const names = new Map(following.map((p) => [p.id, p.username]));
  const { data } = await sb
    .from("user_games")
    .select("user_id, game_data, owned, wishlist, rating, review_text, played_date, updated_at")
    .in("user_id", following.map((p) => p.id))
    .order("updated_at", { ascending: false })
    .limit(40);

  return (data ?? []).flatMap((r): ActivityItem[] => {
    const rating = Number(r.rating) || 0;
    const review = (r.review_text as string | null) ?? "";
    const verb = review
      ? "reviewed"
      : rating > 0
        ? "rated"
        : r.owned
          ? "added to their shelf"
          : r.wishlist
            ? "wishlisted"
            : r.played_date
              ? "played"
              : "";
    const username = names.get(r.user_id as string);
    if (!verb || !username) return [];
    return [
      {
        userId: r.user_id as string,
        username,
        game: cleanGame(r.game_data as Game),
        verb,
        rating,
        review,
        at: Date.parse(r.updated_at as string) || 0,
      },
    ];
  });
}
