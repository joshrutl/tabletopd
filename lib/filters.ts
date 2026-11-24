import type { Game, SortId } from "./types";

export interface GameFilter {
  /** Game must support exactly this many players. */
  players: number | null;
  /** Game must take at most this many minutes. */
  maxTime: number | null;
}

export const NO_FILTER: GameFilter = { players: null, maxTime: null };

/** Value used by the "Quick (< 45m)" chip: strictly under 45 minutes. */
export const QUICK_MAX = 44;

export const PLAYER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export const TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "≤ 15m" },
  { value: 30, label: "≤ 30m" },
  { value: QUICK_MAX, label: "< 45m" },
  { value: 60, label: "≤ 60m" },
  { value: 90, label: "≤ 90m" },
  { value: 120, label: "≤ 2h" },
];

export const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "popular", label: "Popular & Approachable" },
  { id: "rated", label: "Most Rated" },
  { id: "highest", label: "Highest Rated" },
  { id: "newest", label: "Newest" },
];

/** Games with unknown player count / playtime (0) are never excluded. */
export function matchesFilter(g: Game, f: GameFilter): boolean {
  if (f.players && g.maxPlayers > 0 && !(g.minPlayers <= f.players && f.players <= g.maxPlayers)) {
    return false;
  }
  if (f.maxTime && g.playingTime > 0 && g.playingTime > f.maxTime) return false;
  return true;
}
