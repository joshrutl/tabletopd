"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import type { Game, GameList, Shelf } from "@/lib/types";
import { ListSummaryCard } from "./ListsView";
import { isPlayed } from "@/lib/useShelf";
import type { Auth } from "@/lib/useAuth";
import type { TopFourState } from "@/lib/useTopFour";
import StarRating from "./StarRating";
import { Poster } from "./GameCard";
import TopFour from "./TopFour";
import FriendsView from "./FriendsView";

interface Props {
  shelf: Shelf;
  onOpen: (g: Game) => void;
  auth: Auth;
  top: TopFourState;
  onSignIn: () => void;
  lists: GameList[];
  /** Opens My Shelf → Lists, on a specific list or (null) the index. */
  onOpenList: (id: string | null) => void;
}

/** Username + editable bio when signed in; a sign-in prompt when not. */
function AccountCard({ auth, onSignIn }: { auth: Auth; onSignIn: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  /** Native share sheet on phones; otherwise copy the link. */
  const shareProfile = async (username: string) => {
    const url = `${window.location.origin}/u/${username}`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: `@${username} on Tabletopd`, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // user dismissed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied!");
    } catch {
      window.prompt("Copy your profile link:", url);
    }
  };

  if (!auth.configured) {
    return (
      <p className="mb-6 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
        Cloud accounts are off, so your shelf is saved on this device only.
      </p>
    );
  }

  if (!auth.userId) {
    return (
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-emerald/40 bg-emerald/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">Sign in to save your shelf everywhere</p>
          <p className="text-sm text-muted">
            Your shelf and Top 4 currently live only on this device. An account syncs them to the cloud.
          </p>
        </div>
        <button
          onClick={onSignIn}
          className="flex-none rounded-full bg-emerald px-5 py-2 text-sm font-bold text-bg transition hover:brightness-110"
        >
          Sign In / Sign Up
        </button>
      </div>
    );
  }

  const bio = auth.profile?.bio ?? "";
  const save = async () => {
    setSaving(true);
    setError(null);
    const err = await auth.updateBio(draft.trim());
    setSaving(false);
    if (err) setError(err);
    else setEditing(false);
  };

  return (
    <div className="mb-6 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-bold text-white">@{auth.profile?.username ?? auth.email?.split("@")[0]}</p>
        {auth.profile?.username && (
          <button
            onClick={() => shareProfile(auth.profile!.username!)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-white/80 transition hover:border-emerald hover:text-emerald"
          >
            <Share2 size={14} /> Share Profile
          </button>
        )}
      </div>
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald px-5 py-2 text-sm font-bold text-bg shadow-lg"
        >
          {toast}
        </div>
      )}
      {editing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 160))}
            rows={3}
            autoFocus
            placeholder="Tell people what you like to play…"
            aria-label="Bio"
            className="w-full resize-none rounded-md border border-line bg-bg px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-emerald focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>{draft.length}/160</span>
            <span className="flex gap-2">
              <button onClick={() => setEditing(false)} className="px-2 py-1 hover:text-white">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-emerald px-3 py-1 font-semibold text-bg disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </span>
          </div>
          {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
        </div>
      ) : (
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className={`text-sm ${bio ? "text-white/80" : "text-muted"}`}>{bio || "No bio yet."}</p>
          <button
            onClick={() => {
              setDraft(bio);
              setEditing(true);
            }}
            className="flex-none text-xs font-semibold text-emerald hover:underline"
          >
            Edit bio
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileMe({ shelf, onOpen, auth, top, onSignIn, lists, onOpenList }: Props) {
  const stats = useMemo(() => {
    const entries = Object.values(shelf);
    const rated = entries.filter((e) => e.rating > 0);
    return {
      owned: entries.filter((e) => e.owned).length,
      wishlist: entries.filter((e) => e.wishlist).length,
      played: entries.filter(isPlayed).length,
      avg: rated.length ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : null,
      reviews: entries
        .filter((e) => e.review)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10),
    };
  }, [shelf]);

  const tiles = [
    { label: "Owned", value: stats.owned, cls: "text-emerald" },
    { label: "Played", value: stats.played, cls: "text-white" },
    { label: "Wishlist", value: stats.wishlist, cls: "text-amber" },
    { label: "Avg rating", value: stats.avg ? stats.avg.toFixed(1) : "—", cls: "text-emerald" },
  ];
  const heading = "mb-3 text-xs font-semibold uppercase tracking-widest text-muted";

  return (
    <section>
      <h1 className="mb-5 text-xl font-bold text-white">Your Profile</h1>

      <AccountCard auth={auth} onSignIn={onSignIn} />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-line bg-surface p-4">
            <p className={`text-3xl font-extrabold ${t.cls}`}>{t.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted">{t.label}</p>
          </div>
        ))}
      </div>

      <h2 className={heading}>Top 4 favorites</h2>
      <div className="mb-8">
        <TopFour top={top} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Lists</h2>
        <button onClick={() => onOpenList(null)} className="text-xs font-semibold text-emerald hover:underline">
          {lists.length > 0 ? "See all" : "Create a list"}
        </button>
      </div>
      {lists.length === 0 ? (
        <button
          onClick={() => onOpenList(null)}
          className="mb-8 w-full rounded-xl border border-dashed border-line py-8 text-sm text-muted transition hover:border-emerald hover:text-emerald"
        >
          Curate your first list, like &ldquo;Fav 2-Player Games&rdquo;
        </button>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.slice(0, 6).map((l) => (
            <ListSummaryCard key={l.id} list={l} onClick={() => onOpenList(l.id)} />
          ))}
        </div>
      )}

      <h2 className={heading}>Recent reviews</h2>
      {stats.reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
          No reviews yet. Use Log/Rate on a game and write a few words.
        </p>
      ) : (
        <ul className="space-y-3">
          {stats.reviews.map((e) => (
            <li key={e.game.id}>
              <button
                onClick={() => onOpen(e.game)}
                className="flex w-full gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-emerald/60"
              >
                <Poster game={e.game} className="h-24 w-16 flex-none rounded" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{e.game.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {e.rating > 0 && <StarRating value={e.rating} size={13} />}
                    {e.playedOn && <span>Played {e.playedOn}</span>}
                  </div>
                  <p className="mt-1.5 text-sm text-white/80">{e.review}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


/** Profile tab: your own profile, plus a Friends switch (search, following, activity) when signed in. */
export default function ProfileView(props: Props) {
  const [view, setView] = useState<"me" | "friends">("me");
  const userId = props.auth.userId;

  return (
    <>
      {userId && (
        <div role="tablist" aria-label="Profile sections" className="mb-5 grid grid-cols-2 rounded-lg border border-line bg-surface p-1">
          {(["me", "friends"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md py-2 text-sm font-medium transition ${
                view === v ? "bg-line text-white" : "text-muted hover:text-white"
              }`}
            >
              {v === "me" ? "You" : "Friends"}
            </button>
          ))}
        </div>
      )}
      {userId && view === "friends" ? (
        <FriendsView userId={userId} onLog={props.onOpen} />
      ) : (
        <ProfileMe {...props} />
      )}
    </>
  );
}