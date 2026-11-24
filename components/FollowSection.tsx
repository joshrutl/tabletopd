"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { followUser, isFollowing, unfollowUser } from "@/lib/follows";

interface Props {
  profileId: string;
  followers: number;
  following: number;
}

/** Follower / following counts plus the Follow toggle for the public profile page. */
export default function FollowSection({ profileId, followers: initialFollowers, following }: Props) {
  const [me, setMe] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [follows, setFollows] = useState(false);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
      const uid = data.session?.user.id ?? null;
      if (cancelled) return;
      setMe(uid);
      if (uid && uid !== profileId) setFollows(await isFollowing(uid, profileId));
      if (!cancelled) setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const toggle = async () => {
    if (!me || busy) return;
    setBusy(true);
    setError(null);
    const wasFollowing = follows;
    // optimistic
    setFollows(!wasFollowing);
    setFollowers((n) => n + (wasFollowing ? -1 : 1));
    const err = wasFollowing ? await unfollowUser(me, profileId) : await followUser(me, profileId);
    if (err) {
      setFollows(wasFollowing);
      setFollowers((n) => n + (wasFollowing ? 1 : -1));
      setError(err);
    }
    setBusy(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="text-sm text-white/80">
          <span className="font-bold text-white">{followers}</span> {followers === 1 ? "follower" : "followers"}
        </p>
        <p className="text-sm text-white/80">
          <span className="font-bold text-white">{following}</span> following
        </p>

        {checked && me !== profileId && (
          me ? (
            <button
              onClick={toggle}
              disabled={busy}
              aria-pressed={follows}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-bold transition disabled:opacity-60 ${
                follows
                  ? "border border-line text-white/80 hover:border-red-400 hover:text-red-300"
                  : "bg-emerald text-bg hover:brightness-110"
              }`}
            >
              {busy && <Loader2 size={13} className="animate-spin" />}
              {follows ? "Following" : "Follow"}
            </button>
          ) : (
            <Link
              href="/"
              className="rounded-full border border-emerald px-5 py-1.5 text-sm font-semibold text-emerald transition hover:bg-emerald hover:text-bg"
            >
              Sign in to follow
            </Link>
          )
        )}
        {checked && me === profileId && (
          <Link href="/" className="text-sm font-semibold text-emerald hover:underline">
            This is you · open the app
          </Link>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
