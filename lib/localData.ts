import type { Game, GameList, Shelf } from "./types";
import { cleanGame } from "./text";

export const SHELF_KEY = "tabletopd.shelf.v1";
export const TOP_FOUR_KEY = "tabletopd_top_four";
export const LISTS_KEY = "tabletopd_lists";

/** Keeps only well-formed lists from stored/remote data. */
export function parseLists(v: unknown): GameList[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((l): GameList[] => {
    if (!l || typeof l.id !== "string" || typeof l.title !== "string" || !Array.isArray(l.items)) return [];
    return [
      {
        id: l.id,
        title: l.title,
        description: typeof l.description === "string" ? l.description : "",
        isRanked: Boolean(l.isRanked),
        isPublic: l.isPublic !== false,
        items: l.items.flatMap((i: { game?: Game; note?: unknown }) =>
          i?.game && typeof i.game.id === "string" && typeof i.game.name === "string"
            ? [{ game: cleanGame(i.game), note: typeof i.note === "string" ? i.note : "" }]
            : [],
        ),
        createdAt: Number(l.createdAt) || Date.now(),
        updatedAt: Number(l.updatedAt) || Date.now(),
      },
    ];
  });
}

export function readLocalLists(): GameList[] {
  try {
    return parseLists(JSON.parse(localStorage.getItem(LISTS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export const EMPTY_TOP_FOUR: (Game | null)[] = [null, null, null, null];

/** Normalise any stored/remote value into exactly four Game-or-null slots. */
export function parseTopFour(v: unknown): (Game | null)[] {
  if (!Array.isArray(v)) return EMPTY_TOP_FOUR;
  return EMPTY_TOP_FOUR.map((_, i) => {
    const g = v[i] as Partial<Game> | null | undefined;
    return g && typeof g.id === "string" && typeof g.name === "string" ? cleanGame(g as Game) : null;
  });
}

export function readLocalShelf(): Shelf {
  try {
    const raw = localStorage.getItem(SHELF_KEY);
    const v = raw ? JSON.parse(raw) : {};
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const shelf = v as Shelf;
    for (const entry of Object.values(shelf)) if (entry?.game) entry.game = cleanGame(entry.game);
    return shelf;
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
    localStorage.removeItem(LISTS_KEY);
  } catch {
    /* ignore */
  }
}
