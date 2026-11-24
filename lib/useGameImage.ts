"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Game } from "./types";
import { validImageUrl } from "./images";
import { getCachedImage, isRecentImageMiss, recordImageMiss, setCachedImage } from "./imageCache";

/*
 * One shared, batched cover fetcher for every screen (Discover, My Shelf, Game Night, Profile...).
 *
 * Cards ask for a cover by id; asks made within a few milliseconds of each other are sent as a
 * single /api/bgg/images request (up to 15 ids), so a grid of 24 cards costs 2 requests, not 24.
 * That keeps us well under BGG's rate limits, which is what used to leave random cards blank.
 * Results go into imageCache (memory + sessionStorage), so remounting a card never re-asks.
 */

const BATCH_SIZE = 15; // matches the server's /thing chunk size: one BGG call per request
const BATCH_DELAY_MS = 40;
const MAX_PARALLEL = 2;
const TRANSIENT_MISS_MS = 20 * 1000;

const inflight = new Map<string, Promise<string | null>>();
const resolvers = new Map<string, (url: string | null) => void>();
let pending: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let active = 0;
const queue: Array<() => void> = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

async function fetchBatch(ids: string[]) {
  let images: Record<string, string | null> = {};
  let transient = new Set<string>(ids); // assume failure until the server says otherwise
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

  for (const id of ids) {
    const url = validImageUrl(images[id]);
    if (url) setCachedImage(id, url);
    else if (transient.has(id)) recordImageMiss(id, TRANSIENT_MISS_MS); // retry soon
    else recordImageMiss(id); // BGG has no cover for it (or no token yet)
    resolvers.get(id)?.(url);
    resolvers.delete(id);
    inflight.delete(id);
  }
}

function flush() {
  flushTimer = null;
  const ids = pending;
  pending = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    void limited(() => fetchBatch(chunk));
  }
}

/** Resolves to a cover URL (from cache, or one batched request) or null. */
function lookup(id: string): Promise<string | null> {
  const cached = getCachedImage(id);
  if (cached) return Promise.resolve(cached); // already resolved this session: no request
  if (isRecentImageMiss(id)) return Promise.resolve(null);

  let p = inflight.get(id);
  if (!p) {
    p = new Promise<string | null>((resolve) => resolvers.set(id, resolve));
    inflight.set(id, p);
    pending.push(id);
    if (!flushTimer) flushTimer = setTimeout(flush, BATCH_DELAY_MS);
  }
  return p;
}

/**
 * Starts fetching covers for these games right away (used by screens that know their list up
 * front, e.g. Game Night), without waiting for each card to scroll into view. Games that
 * already carry a cover, or are already cached, are skipped.
 */
export function prefetchImages(games: Game[]): void {
  for (const g of games) {
    if (!/^\d+$/.test(g.id)) continue;
    if (validImageUrl(g.image) || validImageUrl(g.thumbnail)) continue;
    void lookup(g.id);
  }
}

/**
 * Box-art URL for a game. Uses the game's own image when it has one, then the session cache
 * (so a remounted card shows its cover immediately, with no request and no flash), and otherwise
 * looks it up once the element scrolls near the viewport. `resolving` is true until that finishes.
 */
export function useGameImage(game: Game, ref: RefObject<Element | null>) {
  const direct = validImageUrl(game.image) ?? validImageUrl(game.thumbnail);
  const numeric = /^\d+$/.test(game.id);

  // Seed from the cache synchronously so a remounted card renders its cover immediately.
  const [found, setFound] = useState<string | null>(() => (direct ? null : getCachedImage(game.id)));
  const [settled, setSettled] = useState(() => (direct ? true : Boolean(getCachedImage(game.id))));

  useEffect(() => {
    if (direct || !numeric) return;
    const cached = getCachedImage(game.id);
    if (cached) {
      setFound(cached);
      setSettled(true);
      return;
    }
    setFound(null);
    setSettled(false);

    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const start = () => {
      lookup(game.id).then((url) => {
        if (cancelled) return;
        setFound(url);
        setSettled(true);
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
  }, [game.id, direct, numeric, ref]);

  return {
    src: direct ?? found,
    resolving: !direct && numeric && !settled,
  };
}
