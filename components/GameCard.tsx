"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Check, Clock, PenLine, Star, Users } from "lucide-react";
import type { Game, ShelfEntry } from "@/lib/types";
import { useGameImage } from "@/lib/useGameImage";
import { forgetCachedImage } from "@/lib/imageCache";

export interface CardHandlers {
  onToggleOwned: (g: Game) => void;
  onToggleWishlist: (g: Game) => void;
  onLog: (g: Game) => void;
}

interface Props extends CardHandlers {
  game: Game;
  entry?: ShelfEntry;
}

export function playerLabel(g: Game): string {
  if (!g.maxPlayers) return "";
  return g.minPlayers === g.maxPlayers ? `${g.minPlayers}p` : `${g.minPlayers}–${g.maxPlayers}p`;
}

export function Poster({
  game,
  className = "",
  clearOverlay = false,
}: {
  game: Game;
  className?: string;
  /** Leave room for card overlay buttons above the placeholder title. */
  clearOverlay?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { src, resolving } = useGameImage(game, ref);
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

  // A different image URL starts the fade-in over.
  useEffect(() => {
    setLoaded(false);
    setBroken(false);
  }, [src]);

  const showImage = Boolean(src) && !broken;

  // An image that neither loads nor errors would leave a grey shimmer forever: give up after 8s
  // and show the styled title card instead.
  useEffect(() => {
    if (!showImage || loaded) return;
    const t = setTimeout(() => setBroken(true), 8000);
    return () => clearTimeout(t);
  }, [showImage, loaded, src]);

  const failed = () => {
    setBroken(true);
    forgetCachedImage(game.id); // don't keep serving a dead URL from the shared cover store
  };
  const h = game.hue ?? (Number(game.id) % 360 || 200);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(145deg, hsl(${h} 45% 28%), hsl(${(h + 40) % 360} 50% 12%))`,
      }}
    >
      {/* Styled title card: the fallback when there is no cover */}
      <span
        className={`absolute inset-x-0 top-0 p-2 text-lg font-bold leading-tight text-white/90 drop-shadow transition-opacity duration-500 ${
          clearOverlay ? "pt-12" : ""
        } ${showImage && loaded ? "opacity-0" : "opacity-100"}`}
      >
        {game.name}
      </span>

      {showImage && (
        // Plain <img> on purpose: no optimizer in the way, and onError falls back to the title card.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={game.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setLoaded(true)}
          onError={failed}
        />
      )}

      {/* Shimmer skeleton while the cover is being looked up or downloaded */}
      {(resolving || (showImage && !loaded)) && <div className="shimmer absolute inset-0" aria-hidden />}
    </div>
  );
}

export default function GameCard({ game, entry, onToggleOwned, onToggleWishlist, onLog }: Props) {
  const btn =
    "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition active:scale-95";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-emerald/50 hover:shadow-xl hover:shadow-black/40">
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Poster game={game} clearOverlay className="h-full w-full transition duration-300 group-hover:scale-105" />

        {/* Wishlist: always-visible round button on the poster */}
        <button
          type="button"
          onClick={() => onToggleWishlist(game)}
          aria-pressed={Boolean(entry?.wishlist)}
          aria-label={`${entry?.wishlist ? "Remove from wishlist" : "Add to wishlist"}: ${game.name}`}
          title="Wishlist"
          className={`absolute left-2 top-2 rounded-full border p-1.5 backdrop-blur-sm transition active:scale-90 ${
            entry?.wishlist
              ? "border-amber bg-amber text-bg"
              : "border-white/25 bg-black/60 text-white hover:border-amber hover:text-amber"
          }`}
        >
          <Bookmark size={14} fill={entry?.wishlist ? "currentColor" : "none"} />
        </button>

        {entry && entry.rating > 0 && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-emerald">
            <Star size={11} fill="currentColor" /> {entry.rating.toFixed(1)}
          </span>
        )}

        {(game.maxPlayers > 0 || game.playingTime > 0) && (
          <div
            title={game.estimated ? "Estimated from category — live data replaces this with a BGG token" : undefined}
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm"
          >
            {game.maxPlayers > 0 && (
              <>
                <Users size={11} /> {playerLabel(game)}
              </>
            )}
            {game.maxPlayers > 0 && game.playingTime > 0 && <span className="text-white/40">•</span>}
            {game.playingTime > 0 && (
              <>
                <Clock size={11} /> {game.playingTime}m
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-3 pt-2.5">
        <h3 className="truncate text-sm font-semibold text-white" title={game.name}>
          {game.name}
        </h3>
        <p className="mt-0.5 flex items-center justify-between text-xs text-muted">
          <span>{game.yearPublished ?? "—"}</span>
          {game.rating && (
            <span className="inline-flex items-center gap-1 text-emerald">
              <Star size={11} fill="currentColor" /> {game.rating.toFixed(1)}
            </span>
          )}
        </p>
      </div>

      {/* Always-visible one-tap actions (no hover needed). */}
      <div className="mt-auto flex gap-1.5 p-2.5 pt-2">
        <button
          type="button"
          onClick={() => onToggleOwned(game)}
          aria-pressed={Boolean(entry?.owned)}
          aria-label={`${entry?.owned ? "Remove from owned" : "Mark owned"}: ${game.name}`}
          className={`${btn} flex-1 ${
            entry?.owned
              ? "border-emerald bg-emerald text-bg"
              : "border-line text-white/80 hover:border-emerald hover:text-emerald"
          }`}
        >
          <Check size={13} strokeWidth={3} /> Own
        </button>
        <button
          type="button"
          onClick={() => onLog(game)}
          aria-label={`Log or rate: ${game.name}`}
          className={`${btn} flex-1 border-line text-white/80 hover:border-emerald hover:text-emerald`}
        >
          <PenLine size={13} /> Log/Rate
        </button>
      </div>
    </article>
  );
}
