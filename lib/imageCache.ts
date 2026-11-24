/**
 * Client-side cache of resolved box-art URLs (bgg_id -> url).
 *
 * Lives at module level so it survives tab switches (the Discover, My Shelf and
 * Profile views unmount and remount their cards), and is mirrored to
 * sessionStorage so it also survives a reload within the same browser tab.
 */

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

export function setCachedImage(id: string, url: string): void {
  hydrate();
  misses.delete(id);
  if (hits.get(id) === url) return;
  hits.set(id, url);
  scheduleWrite();
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
