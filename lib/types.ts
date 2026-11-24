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

export type SortId = "popular" | "rated" | "highest" | "newest";

export interface SearchResponse {
  games: Game[];
  source: "bgg" | "mock" | "local";
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
