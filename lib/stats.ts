import type { Shelf } from "./types";

export interface ShelfStats {
  owned: number;
  played: number;
  avg: number | null;
}

/** Owned / played counts and average rating for a shelf (same rules as the Profile tab). */
export function shelfStats(shelf: Shelf): ShelfStats {
  const entries = Object.values(shelf);
  const rated = entries.filter((e) => e.rating > 0);
  return {
    owned: entries.filter((e) => e.owned).length,
    played: entries.filter((e) => Boolean(e.playedOn) || e.rating > 0).length,
    avg: rated.length ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : null,
  };
}
