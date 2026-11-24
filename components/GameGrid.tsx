"use client";

import type { Game, Shelf } from "@/lib/types";
import GameCard, { type CardHandlers } from "./GameCard";

interface Props extends CardHandlers {
  games: Game[];
  shelf: Shelf;
}

export default function GameGrid({ games, shelf, ...handlers }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {games.map((g) => (
        <GameCard key={g.id} game={g} entry={shelf[g.id]} {...handlers} />
      ))}
    </div>
  );
}
