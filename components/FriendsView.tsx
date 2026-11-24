"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import type { Game } from "@/lib/types";
import {
  fetchActivity,
  fetchFollowers,
  fetchFollowing,
  followUser,
  searchUsers,
  unfollowUser,
  type ActivityItem,
  type PersonRef,
} from "@/lib/follows";
import { Poster } from "./GameCard";
import StarRating from "./StarRating";

interface Props {
  userId: string;
  onLog: (g: Game) => void;
}

type Section = "activity" | "following" | "followers";

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export default function FriendsView({ userId, onLog }: Props) {
  const [section, setSection] = useState<Section>("activity");
  const [following, setFollowing] = useState<PersonRef[]>([]);
  const [followers, setFollowers] = useState<PersonRef[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonRef[]>([]);
  const [searching, setSearching] = useState(false);

  const followingIds = new Set(following.map((p) => p.id));

  const refresh = useCallback(async () => {
    const [fing, fers] = await Promise.all([fetchFollowing(userId), fetchFollowers(userId)]);
    setFollowing(fing);
    setFollowers(fers);
    setActivity(await fetchActivity(fing));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Debounced username search.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchUsers(query, userId);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, userId]);

  const toggleFollow = async (person: PersonRef) => {
    setBusyId(person.id);
    setError(null);
    const err = followingIds.has(person.id) ? await unfollowUser(userId, person.id) : await followUser(userId, person.id);
    if (err) setError(err);
    else await refresh();
    setBusyId(null);
  };

  const FollowBtn = ({ person }: { person: PersonRef }) => {
    const on = followingIds.has(person.id);
    return (
      <button
        onClick={() => toggleFollow(person)}
        disabled={busyId === person.id}
        aria-pressed={on}
        className={`flex-none rounded-full px-4 py-1 text-sm font-bold transition disabled:opacity-60 ${
          on
            ? "border border-line text-white/80 hover:border-red-400 hover:text-red-300"
            : "bg-emerald text-bg hover:brightness-110"
        }`}
      >
        {on ? "Following" : "Follow"}
      </button>
    );
  };

  const PersonRow = ({ person }: { person: PersonRef }) => (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
      <Link href={`/u/${person.username}`} className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-emerald text-sm font-bold uppercase text-bg">
          {person.username[0]}
        </span>
        <span className="truncate font-semibold text-white hover:underline">@{person.username}</span>
      </Link>
      <FollowBtn person={person} />
    </li>
  );

  const sections: { id: Section; label: string; count?: number }[] = [
    { id: "activity", label: "Activity" },
    { id: "following", label: "Following", count: following.length },
    { id: "followers", label: "Followers", count: followers.length },
  ];

  return (
    <section>
      {/* Find people */}
      <div className="relative mb-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find people by username…"
          aria-label="Search users by username"
          className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-9 text-sm text-white placeholder:text-muted focus:border-emerald focus:outline-none"
        />
        {query ? (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {query.trim().length >= 2 && (
        <div className="mb-4">
          {searching ? (
            <p className="flex items-center gap-2 py-3 text-sm text-muted">
              <Loader2 size={14} className="animate-spin text-emerald" /> Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="py-3 text-sm text-muted">No users match &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((p) => (
                <PersonRow key={p.id} person={p} />
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div role="tablist" className="mb-4 mt-4 grid grid-cols-3 rounded-lg border border-line bg-surface p-1">
        {sections.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-md px-1 py-2 text-sm font-medium transition ${
              section === s.id ? "bg-line text-white" : "text-muted hover:text-white"
            }`}
          >
            {s.label}
            {s.count !== undefined && (
              <span className={`ml-1 text-xs ${section === s.id ? "text-emerald" : "text-muted"}`}>{s.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-emerald" />
        </div>
      ) : section === "activity" ? (
        following.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted">
            Follow some people to see what they&apos;re playing, rating and reviewing.
          </p>
        ) : activity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted">
            Nothing yet. Activity from the people you follow will show up here.
          </p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a, i) => (
              <li key={`${a.userId}-${a.game.id}-${i}`} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                <button onClick={() => onLog(a.game)} aria-label={`Open ${a.game.name}`} className="flex-none">
                  <Poster game={a.game} className="h-24 w-16 rounded transition hover:opacity-90" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/80">
                    <Link href={`/u/${a.username}`} className="font-semibold text-white hover:underline">
                      @{a.username}
                    </Link>{" "}
                    {a.verb}
                  </p>
                  <button onClick={() => onLog(a.game)} className="block max-w-full truncate text-left font-semibold text-white hover:text-emerald">
                    {a.game.name}
                  </button>
                  {a.rating > 0 && (
                    <div className="mt-0.5">
                      <StarRating value={a.rating} size={13} />
                    </div>
                  )}
                  {a.review && <p className="mt-1 line-clamp-3 text-sm text-white/75">{a.review}</p>}
                  <p className="mt-1 text-xs text-muted">{timeAgo(a.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        (() => {
          const list = section === "following" ? following : followers;
          return list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted">
              {section === "following" ? "You aren't following anyone yet. Search above." : "No followers yet. Share your profile link."}
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((p) => (
                <PersonRow key={p.id} person={p} />
              ))}
            </ul>
          );
        })()
      )}
    </section>
  );
}
