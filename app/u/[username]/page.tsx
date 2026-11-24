import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Dices } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/admin";
import { parseTopFour } from "@/lib/localData";
import { escapeLike } from "@/lib/follows";
import type { Game } from "@/lib/types";
import { Poster } from "@/components/GameCard";
import FollowSection from "@/components/FollowSection";
import PublicProfileTabs, { type PublicList, type ReviewItem } from "@/components/PublicProfileTabs";

export const dynamic = "force-dynamic";

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

interface GameRow {
  game_data: Game;
  owned: boolean;
  wishlist: boolean;
  rating: number | string | null;
  review_text: string | null;
  played_date: string | null;
  updated_at: string;
}

/** Everything on this page is public data, read with the anon key; RLS decides what comes back. */
async function loadProfile(rawUsername: string) {
  const username = decodeURIComponent(rawUsername);
  if (!USERNAME.test(username)) return null;
  const sb = createAnonClient();
  if (!sb) return null;

  // Case-insensitive (the schema enforces uniqueness on lower(username)).
  const { data: profile } = await sb
    .from("profiles")
    .select("id, username, bio, top_four")
    .ilike("username", escapeLike(username))
    .maybeSingle();
  if (!profile) return null;

  const [games, lists, followers, following] = await Promise.all([
    sb
      .from("user_games")
      .select("game_data, owned, wishlist, rating, review_text, played_date, updated_at")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(1000),
    sb
      .from("lists")
      .select("id, title, description, is_ranked")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("updated_at", { ascending: false }),
    sb.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profile.id),
    sb.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profile.id),
  ]);

  const listRows = lists.data ?? [];
  const itemsByList = new Map<string, Array<{ game: Game; note: string }>>();
  if (listRows.length > 0) {
    const { data: items } = await sb
      .from("list_items")
      .select("list_id, game_data, note, position")
      .in("list_id", listRows.map((l) => l.id))
      .order("position", { ascending: true });
    for (const i of items ?? []) {
      const arr = itemsByList.get(i.list_id) ?? [];
      arr.push({ game: i.game_data as Game, note: i.note ?? "" });
      itemsByList.set(i.list_id, arr);
    }
  }

  const rows = (games.data ?? []) as GameRow[];
  const rated = rows.filter((r) => Number(r.rating) > 0);
  return {
    profile: {
      id: profile.id as string,
      username: profile.username as string,
      bio: (profile.bio as string | null) ?? "",
    },
    topFour: parseTopFour(profile.top_four),
    owned: rows.filter((r) => r.owned).map((r) => r.game_data),
    playedCount: rows.filter((r) => r.played_date || Number(r.rating) > 0).length,
    avgRating: rated.length ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length : null,
    reviews: rows
      .filter((r) => Number(r.rating) > 0 || r.review_text)
      .map(
        (r): ReviewItem => ({
          game: r.game_data,
          rating: Number(r.rating) || 0,
          review: r.review_text ?? "",
          playedOn: r.played_date ?? "",
          at: Date.parse(r.updated_at) || 0,
        }),
      ),
    lists: listRows.map(
      (l): PublicList => ({
        id: l.id,
        title: l.title,
        description: l.description ?? "",
        isRanked: Boolean(l.is_ranked),
        items: itemsByList.get(l.id) ?? [],
      }),
    ),
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const data = await loadProfile((await params).username);
  return { title: data ? `@${data.profile.username} — Tabletopd` : "Profile not found — Tabletopd" };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const data = await loadProfile((await params).username);
  if (!data) notFound();
  const { profile, topFour, owned, playedCount, avgRating, reviews, lists, followers, following } = data;

  const stats = [
    { label: "Owned", value: owned.length, cls: "text-emerald" },
    { label: "Played", value: playedCount, cls: "text-white" },
    { label: "Avg rating", value: avgRating ? avgRating.toFixed(1) : "—", cls: "text-emerald" },
    { label: "Lists", value: lists.length, cls: "text-amber" },
  ];

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-8">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
          <span className="rounded-md bg-emerald p-1 text-bg">
            <Dices size={18} strokeWidth={2.5} />
          </span>
          Tabletopd
        </Link>

        <h1 className="text-2xl font-bold text-white">@{profile.username}</h1>
        {profile.bio && <p className="mt-1.5 max-w-prose text-sm text-white/75">{profile.bio}</p>}
        <div className="mt-4">
          <FollowSection profileId={profile.id} followers={followers} following={following} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-surface p-4">
              <p className={`text-3xl font-extrabold ${s.cls}`}>{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-widest text-muted">Top 4 favorites</h2>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {topFour.map((g, i) =>
            g ? (
              <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line">
                <Poster game={g} clearOverlay className="h-full w-full" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-6">
                  <span className="block truncate text-[11px] font-semibold leading-tight text-white sm:text-sm">
                    {g.name}
                  </span>
                </span>
              </div>
            ) : (
              <div key={i} className="aspect-[3/4] rounded-lg border border-dashed border-line" />
            ),
          )}
        </div>

        <div className="mt-8">
          <PublicProfileTabs owned={owned} reviews={reviews} lists={lists} />
        </div>

        <footer className="mt-12 border-t border-line pt-4 text-center text-xs text-muted">
          Game data powered by{" "}
          <a
            href="https://boardgamegeek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-line underline-offset-2 hover:text-emerald"
          >
            BoardGameGeek
          </a>
        </footer>
      </main>

      {/* Visitors arriving from a shared link can jump straight into the app. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <p className="hidden text-sm text-muted sm:block">Track, rate and share your own board games.</p>
          <Link
            href="/"
            className="ml-auto rounded-full bg-emerald px-5 py-2 text-sm font-bold text-bg transition hover:brightness-110"
          >
            Back to Tabletopd
          </Link>
        </div>
      </div>
    </>
  );
}
