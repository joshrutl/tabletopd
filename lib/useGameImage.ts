"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Game } from "./types";
import { validImageUrl } from "./images";

/* One lookup per game per page load, and at most 4 in flight at once. */
const lookups = new Map<string, Promise<string | null>>();
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

function lookup(id: string): Promise<string | null> {
  let p = lookups.get(id);
  if (!p) {
    p = limited(async () => {
      try {
        const res = await fetch(`/api/bgg/image?id=${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        const data = (await res.json()) as { image_url?: string | null };
        return validImageUrl(data.image_url);
      } catch {
        return null;
      }
    });
    lookups.set(id, p);
  }
  return p;
}

/**
 * Box-art URL for a game. Uses the game's own image when it has one; otherwise
 * looks it up (once the element scrolls near the viewport). `resolving` is true
 * until that lookup finishes, so callers can show a skeleton.
 */
export function useGameImage(game: Game, ref: RefObject<Element | null>) {
  const direct = validImageUrl(game.image) ?? validImageUrl(game.thumbnail);
  const numeric = /^\d+$/.test(game.id);
  const [found, setFound] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setFound(null);
    setSettled(false);
    if (direct || !numeric) return;
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
