export interface Game {
  id: string;
  name: string;
  yearPublished: number | null;
  thumbnail: string | null;
  image: string | null;
  minPlayers: number; // 0 = unknown
  maxPlayers: number; // 0 = unknown
  playingTime: number; // minutes, 0 = unknown
  rating: number | null; // BGG average, 0-10
  /** Placeholder gradient hue used when no box art is available. */
  hue?: number;
  /** True when player count / playtime are guessed from category, not known. */
  estimated?: boolean;
}

/** "hot" is BGG's Hotness feed; the others sort our full ranked catalogue. */
export type SortId = "popular" | "rated" | "highest" | "newest" | "hot";

export interface SearchResponse {
  games: Game[];
  source: "bgg" | "mock" | "local";
  /** False when the order is BGG's own (Hotness / its name search) rather than the chosen sort */
  sortApplied?: boolean;
  /** True when a BGG token is configured, so the "Hot on BGG" sort can be offered */
  hotAvailable?: boolean;
  note?: string;
}

/** One user's relationship to a game, persisted in localStorage. */
export interface ShelfEntry {
  game: Game;
  owned: boolean;
  wishlist: boolean;
  /** 0.5 – 5.0 in half steps, 0 = unrated */
  rating: number;
  review: string;
  /** ISO date (yyyy-mm-dd) or "" if never played */
  playedOn: string;
  updatedAt: number;
}

export type Shelf = Record<string, ShelfEntry>;

/** One game in a custom list. Its position is its index in `GameList.items`. */
export interface ListItem {
  game: Game;
  /** Optional short note, e.g. "Great with 2" */
  note: string;
}

export interface GameList {
  /** UUID, generated on the client so it is the same locally and in Supabase */
  id: string;
  title: string;
  description: string;
  /** Show #1, #2, #3 ... badges */
  isRanked: boolean;
  /** Shareable by link once synced to an account */
  isPublic: boolean;
  items: ListItem[];
  createdAt: number;
  updatedAt: number;
}
