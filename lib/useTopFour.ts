"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game } from "./types";
import { createClient } from "./supabase/client";
import { rememberCovers } from "./imageCache";
import {
  EMPTY_TOP_FOUR,
  parseTopFour,
  readLocalTopFour,
  TOP_FOUR_KEY,
  writeLocal,
} from "./localData";

/** Returns an error message, or null on success. */
async function persist(userId: string, slots: (Game | null)[]): Promise<string | null> {
  const sb = createClient();
  if (!sb) return "Supabase isn't configured.";
  const { error } = await sb.from("profiles").upsert({ id: userId, top_four: slots });
  return error ? error.message : null;
}

/**
 * The user's hand-picked favourites (full Game objects, so picks render without
 * being on the shelf). Signed out: localStorage. Signed in: `profiles.top_four`.
 */
export function useTopFour(userId: string | null, onError: (message: string) => void) {
  const [slots, setSlots] = useState<(Game | null)[]>(EMPTY_TOP_FOUR);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const slotsRef = useRef<(Game | null)[]>(EMPTY_TOP_FOUR);

  const key = userId ?? "local";
  const ready = loadedKey === key;

  useEffect(() => {
    let cancelled = false;
    const finish = (s: (Game | null)[]) => {
      if (cancelled) return;
      rememberCovers(s.filter((g): g is Game => Boolean(g)));
      slotsRef.current = s;
      setSlots(s);
      setLoadedKey(key);
    };

    if (!userId) {
      finish(readLocalTopFour());
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const sb = createClient();
      const { data, error } = sb
        ? await sb.from("profiles").select("top_four").eq("id", userId).maybeSingle()
        : { data: null, error: { message: "Supabase isn't configured." } };
      if (cancelled) return;
      if (error) onError(`Couldn't load your Top 4: ${error.message}`);
      finish(parseTopFour(data?.top_four));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId && loadedKey === "local") writeLocal(TOP_FOUR_KEY, slots);
  }, [slots, userId, loadedKey]);

  const commit = useCallback(
    (next: (Game | null)[]) => {
      if (!ready) return;
      slotsRef.current = next;
      setSlots(next);
      if (userId) {
        void persist(userId, next).then((err) => {
          if (err) onError(`Couldn't sync your Top 4: ${err}`);
        });
      }
    },
    [ready, userId, onError],
  );

  const setSlot = useCallback(
    (i: number, game: Game | null) => commit(slotsRef.current.map((g, idx) => (idx === i ? game : g))),
    [commit],
  );

  /** Swap two slots (an empty target just receives the game). */
  const swap = useCallback(
    (a: number, b: number) => {
      if (a === b || a < 0 || b < 0 || a > 3 || b > 3) return;
      const next = [...slotsRef.current];
      [next[a], next[b]] = [next[b], next[a]];
      commit(next);
    },
    [commit],
  );

  /** Replace all four slots (used when importing this device's data). */
  const replaceAll = useCallback(
    async (next: (Game | null)[]): Promise<string | null> => {
      if (!ready) return "Not ready yet.";
      slotsRef.current = next;
      setSlots(next);
      return userId ? persist(userId, next) : null;
    },
    [ready, userId],
  );

  return { slots, setSlot, swap, replaceAll, ready };
}

export type TopFourState = ReturnType<typeof useTopFour>;
