"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Shelf, ShelfEntry } from "@/lib/types";
import { isPlayed } from "@/lib/useShelf";
import type { CardHandlers } from "./GameCard";
import GameGrid from "./GameGrid";

type Seg = "owned" | "played" | "wishlist";

const SEGMENTS: { id: Seg; label: string; test: (e: ShelfEntry) => boolean; empty: string }[] = [
  { id: "owned", label: "Owned", test: (e) => e.owned, empty: "No owned games yet. Tap Own on any game." },
  {
    id: "played",
    label: "Played & Rated",
    test: isPlayed,
    empty: "Nothing logged yet. Tap Log/Rate on a game you've played.",
  },
  { id: "wishlist", label: "Wishlist", test: (e) => e.wishlist, empty: "Your wishlist is empty. Tap the bookmark on a game." },
];

interface Props extends CardHandlers {
  shelf: Shelf;
}

export default function ShelfView({ shelf, ...handlers }: Props) {
  const [seg, setSeg] = useState<Seg>("owned");
  const [q, setQ] = useState("");

  const entries = useMemo(
    () => Object.values(shelf).sort((a, b) => b.updatedAt - a.updatedAt),
    [shelf],
  );
  const current = SEGMENTS.find((s) => s.id === seg)!;
  const needle = q.trim().toLowerCase();
  const games = entries
    .filter(current.test)
    .filter((e) => !needle || e.game.name.toLowerCase().includes(needle))
    .map((e) => e.game);

  return (
    <section>
      <div role="tablist" aria-label="Shelf sections" className="mb-4 grid grid-cols-3 rounded-lg border border-line bg-surface p-1">
        {SEGMENTS.map((s) => {
          const active = s.id === seg;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              onClick={() => setSeg(s.id)}
              className={`rounded-md px-1 py-2 text-[13px] font-medium leading-tight transition sm:text-sm ${
                active ? "bg-line text-white" : "text-muted hover:text-white"
              }`}
            >
              {s.label}
              <span className={`ml-1 text-xs ${active ? "text-emerald" : "text-muted"}`}>
                {entries.filter(s.test).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your shelf…"
          aria-label="Search your shelf"
          className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-9 text-sm text-white placeholder:text-muted focus:border-emerald focus:outline-none"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Clear shelf search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {games.length === 0 ? (
        <p className="py-20 text-center text-muted">{needle ? "No games on this shelf match your search." : current.empty}</p>
      ) : (
        <GameGrid games={games} shelf={shelf} {...handlers} />
      )}
    </section>
  );
}
