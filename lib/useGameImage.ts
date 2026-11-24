"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Game } from "./types";
import { validImageUrl } from "./images";
import { getCachedImage, isRecentImageMiss, recordImageMiss, setCachedImage } from "./imageCache";

/* In-flight lookups (deduped), at most 4 running at once. Results live in imageCache. */
const inflight = new Map<string, Promise<string | null>>();
let active = 0;
const queue: Array<() => void> = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 4) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

const TRANSIENT_MISS_MS = 20 * 1000;

function lookup(id: string): Promise<string | null> {
  const cached = getCachedImage(id);
  if (cached) return Promise.resolve(cached); // already resolved this session: no request
  if (isRecentImageMiss(id)) return Promise.resolve(null);

  let p = inflight.get(id);
  if (!p) {
    p = limited(async () => {
      try {
        const res = await fetch(`/api/bgg/image?id=${encodeURIComponent(id)}`);
        if (!res.ok) {
          recordImageMiss(id, TRANSIENT_MISS_MS);
          return null;
        }
        const url = validImageUrl(((await res.json()) as { image_url?: string | null }).image_url);
        if (url) setCachedImage(id, url);
        else recordImageMiss(id); // a definite "no image yet" (e.g. no BGG token configured)
        return url;
      } catch {
        // Network blip: retry soon rather than remembering a failure for the whole session.
        recordImageMiss(id, TRANSIENT_MISS_MS);
        return null;
      }
    }).finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p;
}

/**
 * Box-art URL for a game. Uses the game's own image when it has one, then the
 * session cache (so remounting a card on a tab switch shows its cover with no
 * request and no flash), and otherwise looks it up once the element scrolls
 * near the viewport. `resolving` is true until that finishes.
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
