import type { Game, Shelf } from "./types";

export const SHELF_KEY = "tabletopd.shelf.v1";
export const TOP_FOUR_KEY = "tabletopd_top_four";

export const EMPTY_TOP_FOUR: (Game | null)[] = [null, null, null, null];

/** Normalise any stored/remote value into exactly four Game-or-null slots. */
export function parseTopFour(v: unknown): (Game | null)[] {
  if (!Array.isArray(v)) return EMPTY_TOP_FOUR;
  return EMPTY_TOP_FOUR.map((_, i) => {
    const g = v[i] as Partial<Game> | null | undefined;
    return g && typeof g.id === "string" && typeof g.name === "string" ? (g as Game) : null;
  });
}

export function readLocalShelf(): Shelf {
  try {
    const raw = localStorage.getItem(SHELF_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Shelf) : {};
  } catch {
    return {};
  }
}

export function readLocalTopFour(): (Game | null)[] {
  try {
    return parseTopFour(JSON.parse(localStorage.getItem(TOP_FOUR_KEY) ?? "null"));
  } catch {
    return EMPTY_TOP_FOUR;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

/** Remove this device's anonymous data (after it has been imported to an account). */
export function clearLocalData() {
  try {
    localStorage.removeItem(SHELF_KEY);
    localStorage.removeItem(TOP_FOUR_KEY);
  } catch {
    /* ignore */
  }
}
