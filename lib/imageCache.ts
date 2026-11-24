/**
 * Client-side cache of resolved box-art URLs (bgg_id -> url).
 *
 * Lives at module level so it survives tab switches (the Discover, My Shelf and
 * Profile views unmount and remount their cards), and is mirrored to
 * sessionStorage so it also survives a reload within the same browser tab.
 */

import type { Game, Shelf } from "./types";
import { validImageUrl } from "./images";

const STORAGE_KEY = "tabletopd_img_cache_v1";
const MAX_ENTRIES = 600;
const MISS_TTL_MS = 5 * 60 * 1000; // the server said "no image": don't ask again for 5 minutes

const hits = new Map<string, string>();
const misses = new Map<string, number>();
let hydrated = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    for (const [id, url] of Object.entries(JSON.parse(raw) as Record<string, unknown>)) {
      if (typeof url === "string") hits.set(id, url);
    }
  } catch {
    /* storage unavailable or corrupt: start empty */
  }
}

function scheduleWrite() {
  if (typeof window === "undefined" || writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      // Keep the most recent entries if we're over the cap.
      const entries = [...hits.entries()].slice(-MAX_ENTRIES);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* quota exceeded or blocked: the in-memory cache still works */
    }
  }, 250);
}

export function getCachedImage(id: string): string | null {
  hydrate();
  return hits.get(id) ?? null;
}

/**
 * Teach the cache every cover we already know about. Games loaded from your shelf, lists, Top 4
 * or search results often carry a cover URL; other screens render the same game from an object
 * without one (a fresh search result), and would otherwise show a blank card even though the
 * cover is known. Seeding makes every card for that game find it instantly.
 */
export function rememberCovers(games: Array<Pick<Game, "id" | "image" | "thumbnail">>): void {
  for (const g of games) {
    if (!g || hits.has(g.id)) continue;
    const url = validImageUrl(g.image) ?? validImageUrl(g.thumbnail);
    if (url) setCachedImage(g.id, url);
  }
}

/**
 * The game with a known cover merged in (from the cache, else from the user's shelf entry),
 * so a card can render it on first paint. Returns the same object if it already has a cover
 * or none is known.
 */
export function withKnownCover<T extends Pick<Game, "id" | "image" | "thumbnail">>(game: T, shelf?: Shelf): T {
  if (validImageUrl(game.image) || validImageUrl(game.thumbnail)) return game;
  const stored = shelf?.[game.id]?.game;
  const url = getCachedImage(game.id) ?? validImageUrl(stored?.image) ?? validImageUrl(stored?.thumbnail);
  return url ? { ...game, thumbnail: url } : game;
}

type CoverListener = (id: string, url: string) => void;
const listeners = new Set<CoverListener>();

/**
 * Be told whenever a game's cover becomes known (a lookup resolved, or covers were seeded).
 * The shelf and lists use this to store the URL on their games in memory, so those cards
 * carry their cover with them. Returns an unsubscribe function.
 */
export function onCoverKnown(listener: CoverListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setCachedImage(id: string, url: string): void {
  hydrate();
  misses.delete(id);
  if (hits.get(id) === url) return;
  hits.set(id, url);
  scheduleWrite();
  for (const l of listeners) l(id, url);
}

/** Drops a URL that turned out to be broken so it gets looked up again later. */
export function forgetCachedImage(id: string): void {
  hydrate();
  if (hits.delete(id)) scheduleWrite();
}

/** `ttlMs` is shorter for transient failures than for a definite "no image". */
export function recordImageMiss(id: string, ttlMs: number = MISS_TTL_MS): void {
  misses.set(id, Date.now() + ttlMs);
}

export function isRecentImageMiss(id: string): boolean {
  const until = misses.get(id);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  misses.delete(id);
  return false;
}
