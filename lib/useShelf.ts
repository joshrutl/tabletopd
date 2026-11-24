"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, Shelf, ShelfEntry } from "./types";
import { createClient } from "./supabase/client";
import { readLocalShelf, SHELF_KEY, writeLocal } from "./localData";
import { getCachedImage } from "./imageCache";
import { cleanGame } from "./text";

export function emptyEntry(game: Game): ShelfEntry {
  return {
    game,
    owned: false,
    wishlist: false,
    rating: 0,
    review: "",
    playedOn: "",
    updatedAt: Date.now(),
  };
}

/** A game counts as "played" once it has a play date or a rating. */
export function isPlayed(e: ShelfEntry): boolean {
  return Boolean(e.playedOn) || e.rating > 0;
}

const isEmpty = (e: ShelfEntry) =>
  !e.owned && !e.wishlist && !e.rating && !e.playedOn && !e.review.trim();

/* ---------------------------- Supabase mapping ---------------------------- */

interface Row {
  bgg_id: number;
  game_data: Game;
  owned: boolean;
  wishlist: boolean;
  rating: number | string | null;
  review_text: string | null;
  played_date: string | null;
  updated_at: string;
}

function toRow(userId: string, e: ShelfEntry) {
  return {
    user_id: userId,
    bgg_id: Number(e.game.id),
    game_data: e.game,
    // Summary value; the booleans below are what the app reads back.
    status: e.owned ? "owned" : e.wishlist ? "wishlist" : "played",
    owned: e.owned,
    wishlist: e.wishlist,
    rating: e.rating > 0 ? e.rating : null,
    review_text: e.review || null,
    played_date: e.playedOn || null,
  };
}

/** Fills in `thumbnail` from the session image cache when the game doesn't carry a cover yet. */
function withCachedCover(game: Game): Game {
  if (game.thumbnail || game.image) return game;
  const url = getCachedImage(game.id);
  return url ? { ...game, thumbnail: url } : game;
}

function fromRow(r: Row): ShelfEntry {
  return {
    game: cleanGame(r.game_data), // older rows may hold names like "Andromeda&#039;s Edge"
    owned: r.owned,
    wishlist: r.wishlist,
    rating: Number(r.rating) || 0,
    review: r.review_text ?? "",
    playedOn: r.played_date ?? "",
    updatedAt: Date.parse(r.updated_at) || Date.now(),
  };
}

const syncable = (e: ShelfEntry) => Number.isInteger(Number(e.game.id));

/** Returns an error message, or null on success. */
async function persist(userId: string, gameId: string, entry: ShelfEntry | null): Promise<string | null> {
  const sb = createClient();
  if (!sb) return "Supabase isn't configured.";
  if (!Number.isInteger(Number(gameId))) return null;
  const { error } = entry
    ? await sb.from("user_games").upsert(toRow(userId, entry))
    : await sb.from("user_games").delete().eq("user_id", userId).eq("bgg_id", Number(gameId));
  return error ? error.message : null;
}

/* ---------------------------------- hook ---------------------------------- */

/**
 * The user's shelf. Signed out: lives in localStorage. Signed in: lives in
 * Supabase `user_games`, updated optimistically on every change.
 */
export function useShelf(userId: string | null, onError: (message: string) => void) {
  const [shelf, setShelf] = useState<Shelf>({});
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const shelfRef = useRef<Shelf>({});

  const key = userId ?? "local";
  const ready = loadedKey === key;

  useEffect(() => {
    let cancelled = false;
    const finish = (s: Shelf) => {
      if (cancelled) return;
      shelfRef.current = s;
      setShelf(s);
      setLoadedKey(key);
    };

    if (!userId) {
      finish(readLocalShelf());
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const sb = createClient();
      const { data, error } = sb
        ? await sb.from("user_games").select("*").eq("user_id", userId)
        : { data: null, error: { message: "Supabase isn't configured." } };
      if (cancelled) return;
      if (error) onError(`Couldn't load your shelf: ${error.message}`);
      const s: Shelf = {};
      for (const r of (data ?? []) as Row[]) s[String(r.bgg_id)] = fromRow(r);
      finish(s);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Signed-out mode mirrors state into localStorage (only once this key has loaded).
  useEffect(() => {
    if (!userId && loadedKey === "local") writeLocal(SHELF_KEY, shelf);
  }, [shelf, userId, loadedKey]);

  const apply = useCallback(
    (game: Game, mutate: (cur: ShelfEntry) => ShelfEntry) => {
      if (!ready) return;
      const cur = shelfRef.current[game.id] ?? emptyEntry(game);
      const mutated = mutate(cur);
      // Store the cover URL we already resolved in the saved game, so shelf cards render it instantly
      // next time instead of waiting on an image lookup.
      const updated = { ...mutated, game: withCachedCover(mutated.game), updatedAt: Date.now() };
      const empty = isEmpty(updated);
      const next = { ...shelfRef.current };
      if (empty) delete next[game.id];
      else next[game.id] = updated;
      shelfRef.current = next;
      setShelf(next);
      if (userId) {
        void persist(userId, game.id, empty ? null : updated).then((err) => {
          if (err) onError(`Couldn't sync your change: ${err}`);
        });
      }
    },
    [ready, userId, onError],
  );

  const save = useCallback((entry: ShelfEntry) => apply(entry.game, () => entry), [apply]);

  const toggle = useCallback(
    (game: Game, field: "owned" | "wishlist") => apply(game, (cur) => ({ ...cur, [field]: !cur[field] })),
    [apply],
  );

  /** Bulk-add entries (used when importing this device's data into an account). */
  const importEntries = useCallback(
    async (entries: ShelfEntry[]): Promise<string | null> => {
      if (!ready) return "Not ready yet.";
      const next = { ...shelfRef.current };
      for (const e of entries) next[e.game.id] = e;
      shelfRef.current = next;
      setShelf(next);
      if (!userId) return null;
      const sb = createClient();
      const rows = entries.filter(syncable).map((e) => toRow(userId, e));
      if (!sb || rows.length === 0) return null;
      const { error } = await sb.from("user_games").upsert(rows);
      return error ? error.message : null;
    },
    [ready, userId],
  );

  return { shelf, save, toggle, importEntries, ready };
}
