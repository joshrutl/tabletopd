"use client";

import { useEffect, useState } from "react";
import { Bookmark, Check, X } from "lucide-react";
import type { Game, ShelfEntry } from "@/lib/types";
import { emptyEntry } from "@/lib/useShelf";
import StarRating from "./StarRating";
import { Poster, playerLabel } from "./GameCard";

interface Props {
  game: Game;
  entry?: ShelfEntry;
  onSave: (entry: ShelfEntry) => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function LogModal({ game, entry, onSave, onClose }: Props) {
  const initial = entry ?? emptyEntry(game);
  const [rating, setRating] = useState(initial.rating);
  const [owned, setOwned] = useState(initial.owned);
  const [wishlist, setWishlist] = useState(initial.wishlist);
  const [playedOn, setPlayedOn] = useState(initial.playedOn || today());
  const [played, setPlayed] = useState(Boolean(initial.playedOn) || initial.rating > 0 || !entry);
  const [review, setReview] = useState(initial.review);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      game,
      owned,
      wishlist,
      rating,
      review: review.trim(),
      playedOn: played ? playedOn : "",
      updatedAt: Date.now(),
    });
    onClose();
  };

  const toggleBase =
    "inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={`Log ${game.name}`}
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-surface shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-line hover:text-white"
        >
          <X size={18} />
        </button>

        <header className="flex gap-4 border-b border-line p-5">
          <Poster game={game} className="h-28 w-20 flex-none rounded-md" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted">I played…</p>
            <h2 className="truncate text-xl font-bold text-white">{game.name}</h2>
            <p className="text-sm text-muted">
              {game.yearPublished ?? "—"}
              {game.maxPlayers > 0 && ` · ${playerLabel(game)}`}
              {game.playingTime > 0 && ` · ${game.playingTime}m`}
            </p>
          </div>
        </header>

        <div className="space-y-5 p-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOwned((v) => !v)}
              aria-pressed={owned}
              className={`${toggleBase} ${
                owned ? "border-emerald bg-emerald/15 text-emerald" : "border-line text-muted hover:text-white"
              }`}
            >
              <Check size={16} /> I Own This
            </button>
            <button
              type="button"
              onClick={() => setWishlist((v) => !v)}
              aria-pressed={wishlist}
              className={`${toggleBase} ${
                wishlist ? "border-amber bg-amber/15 text-amber" : "border-line text-muted hover:text-white"
              }`}
            >
              <Bookmark size={16} fill={wishlist ? "currentColor" : "none"} /> Wishlist
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={played}
                  onChange={(e) => setPlayed(e.target.checked)}
                  className="accent-emerald"
                />
                Played on
              </span>
              <input
                type="date"
                value={playedOn}
                max={today()}
                disabled={!played}
                onChange={(e) => setPlayedOn(e.target.value)}
                className="rounded-md border border-line bg-bg px-3 py-1.5 text-sm normal-case text-white disabled:opacity-40"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-muted">
                Rating {rating > 0 && <span className="ml-1 text-emerald">{rating.toFixed(1)}</span>}
              </span>
              <StarRating value={rating} onChange={setRating} size={30} />
            </div>
          </div>

          <label className="block text-xs uppercase tracking-wider text-muted">
            Review
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Add a short review…"
              className="mt-1 w-full resize-none rounded-md border border-line bg-bg px-3 py-2 text-sm normal-case text-white placeholder:text-muted/60 focus:border-emerald focus:outline-none"
            />
            <span className="mt-1 block text-right normal-case">{review.length}/500</span>
          </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-muted hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-emerald px-5 py-2 text-sm font-semibold text-bg transition hover:brightness-110"
          >
            Save
          </button>
        </footer>
      </form>
    </div>
  );
}
