/**
 * The app-wide store of box-art URLs, keyed by BGG id.
 *
 * - Keys are always numbers (`Number(id)`), so "13" and 13 can never be two different entries.
 * - It is reactive: cards read it with useSyncExternalStore (see useGameImage), so every mounted
 *   card for a game, on Discover, Game Night or My Shelf, re-renders the moment its cover is
 *   known. That fixes cards that mounted before a cover arrived and then never updated.
 * - It is mirrored to localStorage, so covers survive reloads and mobile browser restarts.
 *
 * It is a module-level store rather than a React context provider: same behaviour, but each card
 * subscribes to just its own id and nothing needs wrapping.
 */

import type { Game, Shelf } from "./types";
import { validImageUrl } from "./images";

const STORAGE_KEY = "tabletopd_img_cache_v1";
const MAX_ENTRIES = 1500;
const MISS_TTL_MS = 5 * 60 * 1000; // the server said "no image": don't ask again for 5 minutes
const BROKEN_TTL_MS = 60 * 1000; // a cached URL failed to load: don't re-resolve it in a loop

type Id = string | number;

/** Canonical key for a BGG id, or null for anything that isn't one (e.g. a custom game). */
const keyOf = (id: Id): number | null => {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const hits = new Map<number, string>();
const misses = new Map<number, number>();
let hydrated = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    for (const [id, url] of Object.entries(JSON.parse(raw) as Record<string, unknown>)) {
      const key = keyOf(id);
      const clean = typeof url === "string" ? validImageUrl(url) : null;
      if (key && clean) hits.set(key, clean);
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
      const entries = [...hits.entries()].slice(-MAX_ENTRIES); // keep the most recent if over the cap
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* quota exceeded or blocked: the in-memory store still works */
    }
  }, 250);
}

/* ------------------------------- subscriptions ------------------------------ */

const storeListeners = new Set<() => void>();
const coverListeners = new Set<(id: string, url: string) => void>();

/** For useSyncExternalStore: called whenever any cover is added or removed. */
export function subscribeCovers(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

/**
 * Be told whenever a game's cover becomes known. The shelf and lists use this to store the URL
 * on their games in memory. Returns an unsubscribe function.
 */
export function onCoverKnown(listener: (id: string, url: string) => void): () => void {
  coverListeners.add(listener);
  return () => coverListeners.delete(listener);
}

function notify() {
  for (const l of storeListeners) l();
}

/* ---------------------------------- covers ---------------------------------- */

export function getCachedImage(id: Id): string | null {
  hydrate();
  const key = keyOf(id);
  return key === null ? null : (hits.get(key) ?? null);
}

export function setCachedImage(id: Id, url: string): void {
  hydrate();
  const key = keyOf(id);
  if (key === null) return;
  misses.delete(key);
  if (hits.get(key) === url) return;
  hits.set(key, url);
  scheduleWrite();
  notify();
  for (const l of coverListeners) l(String(key), url);
}

/** Drops a URL that turned out to be broken, and briefly stops it being looked up again. */
export function forgetCachedImage(id: Id): void {
  hydrate();
  const key = keyOf(id);
  if (key === null) return;
  misses.set(key, Date.now() + BROKEN_TTL_MS);
  if (hits.delete(key)) {
    scheduleWrite();
    notify();
  }
}

/**
 * Teach the store every cover we already know about: games loaded from your shelf, lists, Top 4
 * or search results often carry one, and other screens render the same game from an object
 * without it.
 */
export function rememberCovers(games: Array<Pick<Game, "id" | "image" | "thumbnail">>): void {
  for (const g of games) {
    if (!g || getCachedImage(g.id)) continue;
    const url = validImageUrl(g.image) ?? validImageUrl(g.thumbnail);
    if (url) setCachedImage(g.id, url);
  }
}

/**
 * The game with a known cover merged in (from the store, else from the user's shelf entry), so a
 * card can render it on first paint. Returns the same object if it already has a cover or none
 * is known.
 */
export function withKnownCover<T extends Pick<Game, "id" | "image" | "thumbnail">>(game: T, shelf?: Shelf): T {
  if (validImageUrl(game.image) || validImageUrl(game.thumbnail)) return game;
  const stored = shelf?.[game.id]?.game;
  const url = getCachedImage(game.id) ?? validImageUrl(stored?.image) ?? validImageUrl(stored?.thumbnail);
  return url ? { ...game, thumbnail: url } : game;
}

/* ----------------------------------- misses ---------------------------------- */

/** `ttlMs` is shorter for transient failures than for a definite "no image". */
export function recordImageMiss(id: Id, ttlMs: number = MISS_TTL_MS): void {
  const key = keyOf(id);
  if (key !== null) misses.set(key, Date.now() + ttlMs);
}

export function clearImageMiss(id: Id): void {
  const key = keyOf(id);
  if (key !== null) misses.delete(key);
}

export function isRecentImageMiss(id: Id): boolean {
  const key = keyOf(id);
  if (key === null) return false;
  const until = misses.get(key);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  misses.delete(key);
  return false;
}
