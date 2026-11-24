"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import type { Game } from "./types";
import { validImageUrl } from "./images";
import {
  clearImageMiss,
  getCachedImage,
  isRecentImageMiss,
  recordImageMiss,
  setCachedImage,
  subscribeCovers,
} from "./imageCache";

/*
 * One shared, queued cover fetcher for every screen (Discover, My Shelf, Game Night, Profile...).
 *
 * Cards ask for a cover by id. Asks are collected for 50ms, de-duplicated, and anything already
 * known (memory / localStorage) is dropped. What's left goes out as clean sequential batches of
 * 15 via /api/bgg/images. An id that comes back missing or unchecked gets one automatic retry
 * after 1.5s. Results land in the shared store (imageCache), which every card is subscribed to,
 * so a cover appears everywhere the moment it is known, including on cards that mounted earlier.
 */

const BATCH_SIZE = 15; // matches the server's /thing chunk size: one BGG call per request
const DEBOUNCE_MS = 50;
const RETRY_DELAY_MS = 1500;
const TRANSIENT_MISS_MS = 20 * 1000;

const inflight = new Map<number, Promise<string | null>>();
const resolvers = new Map<number, (url: string | null) => void>();
let pending: number[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Batches run strictly one after another. */
let chain: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>) {
  chain = chain.then(task, task);
}

async function fetchBatch(ids: number[], isRetry: boolean) {
  let images: Record<string, string | null> = {};
  let transient = new Set<string>(ids.map(String)); // assume failure until the server says otherwise
  try {
    const res = await fetch(`/api/bgg/images?ids=${ids.join(",")}`);
    if (res.ok) {
      const data = (await res.json()) as { images?: Record<string, string | null>; transient?: string[] };
      images = data.images ?? {};
      transient = new Set(data.transient ?? []);
    }
  } catch {
    /* network blip: every id stays transient */
  }

  const retryIds: number[] = [];
  for (const id of ids) {
    const url = validImageUrl(images[String(id)]);
    if (url) {
      setCachedImage(id, url);
    } else if (transient.has(String(id)) || !(String(id) in images)) {
      // Unchecked or missing from the response: worth one more try shortly.
      recordImageMiss(id, TRANSIENT_MISS_MS);
      if (!isRetry) retryIds.push(id);
    } else {
      recordImageMiss(id); // BGG answered and has no cover for it (or no token yet): don't retry
    }
    resolvers.get(id)?.(url);
    resolvers.delete(id);
    inflight.delete(id);
  }

  if (retryIds.length > 0) {
    setTimeout(() => {
      const again = retryIds.filter((id) => {
        clearImageMiss(id);
        return !getCachedImage(id);
      });
      for (let i = 0; i < again.length; i += BATCH_SIZE) {
        const chunk = again.slice(i, i + BATCH_SIZE);
        enqueue(() => fetchBatch(chunk, true));
      }
    }, RETRY_DELAY_MS);
  }
}

function flush() {
  flushTimer = null;
  const ids = [...new Set(pending)].filter((id) => !getCachedImage(id)); // re-check: it may have arrived
  pending = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    enqueue(() => fetchBatch(chunk, false));
  }
  // Anything dropped as already-known still has a waiting promise; settle it.
  for (const [id, resolve] of [...resolvers]) {
    if (!ids.includes(id) && getCachedImage(id)) {
      resolve(getCachedImage(id));
      resolvers.delete(id);
      inflight.delete(id);
    }
  }
}

/** Resolves once this id has been looked up (to a URL, or null). Already-known ids resolve instantly. */
function lookup(rawId: string): Promise<string | null> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return Promise.resolve(null);
  const cached = getCachedImage(id);
  if (cached) return Promise.resolve(cached);
  if (isRecentImageMiss(id)) return Promise.resolve(null);

  let p = inflight.get(id);
  if (!p) {
    p = new Promise<string | null>((resolve) => resolvers.set(id, resolve));
    inflight.set(id, p);
    pending.push(id);
    if (!flushTimer) flushTimer = setTimeout(flush, DEBOUNCE_MS);
  }
  return p;
}

/**
 * Starts fetching covers for these games right away (used by screens that know their list up
 * front, e.g. Game Night), without waiting for each card to scroll into view. Games that
 * already carry a cover, or are already known, are skipped.
 */
export function prefetchImages(games: Game[]): void {
  for (const g of games) {
    if (!/^\d+$/.test(g.id)) continue;
    if (validImageUrl(g.image) || validImageUrl(g.thumbnail)) continue;
    void lookup(g.id);
  }
}

/**
 * Box-art URL for a game, kept live: the card re-renders whenever the shared store learns this
 * game's cover, whichever screen that happened on. The game's own image wins and is also fed into
 * the store so other cards for the same game get it. Otherwise the cover is looked up once the
 * element scrolls near the viewport. `resolving` is true until that lookup finishes.
 */
export function useGameImage(game: Game, ref: RefObject<Element | null>) {
  const direct = validImageUrl(game.image) ?? validImageUrl(game.thumbnail);
  const numeric = /^\d+$/.test(game.id);

  // Subscribes this card to its own id: re-renders only when its cover changes.
  const shared = useSyncExternalStore(
    subscribeCovers,
    () => getCachedImage(game.id),
    () => null,
  );

  // A game that already has a cover (e.g. a My Shelf item) teaches it to the shared store.
  useEffect(() => {
    if (direct) setCachedImage(game.id, direct);
  }, [direct, game.id]);

  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (direct || !numeric || shared) return;
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const start = () => {
      setSettled(false);
      lookup(game.id).then(() => {
        if (!cancelled) setSettled(true);
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, direct, numeric, shared, ref]);

  const src = direct ?? shared;
  return {
    src,
    resolving: !src && numeric && !settled,
  };
}
