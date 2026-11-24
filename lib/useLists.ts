"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, GameList } from "./types";
import { createClient } from "./supabase/client";
import { LISTS_KEY, readLocalLists, writeLocal } from "./localData";
import { cleanGame } from "./text";
import { onCoverKnown, rememberCovers } from "./imageCache";

/* ---------------------------- Supabase mapping ---------------------------- */

interface ListRow {
  id: string;
  title: string;
  description: string | null;
  is_ranked: boolean | null;
  is_public: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ItemRow {
  list_id: string;
  bgg_id: number;
  game_data: Game;
  note: string | null;
  position: number;
}

const numericId = (g: Game) => Number.isInteger(Number(g.id));

/** Writes a whole list (metadata, items and their order). Returns an error message or null. */
async function persistList(userId: string, list: GameList): Promise<string | null> {
  const sb = createClient();
  if (!sb) return "Supabase isn't configured.";

  const { error } = await sb.from("lists").upsert({
    id: list.id,
    user_id: userId,
    title: list.title,
    description: list.description,
    is_ranked: list.isRanked,
    is_public: list.isPublic,
  });
  if (error) return error.message;

  const items = list.items.filter((i) => numericId(i.game));
  if (items.length > 0) {
    const { error: itemsError } = await sb.from("list_items").upsert(
      items.map((i, position) => ({
        list_id: list.id,
        bgg_id: Number(i.game.id),
        game_data: i.game,
        note: i.note,
        position,
      })),
      { onConflict: "list_id,bgg_id" },
    );
    if (itemsError) return itemsError.message;
  }

  // Remove items that are no longer in the list.
  const stale = sb.from("list_items").delete().eq("list_id", list.id);
  const { error: delError } =
    items.length > 0 ? await stale.not("bgg_id", "in", `(${items.map((i) => Number(i.game.id)).join(",")})`) : await stale;
  return delError ? delError.message : null;
}

/* ---------------------------------- hook ---------------------------------- */

/**
 * The user's custom lists. Signed out: localStorage. Signed in: Supabase
 * `lists` + `list_items`, updated optimistically on every change.
 */
export function useLists(userId: string | null, onError: (message: string) => void) {
  const [lists, setLists] = useState<GameList[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const listsRef = useRef<GameList[]>([]);

  const key = userId ?? "local";
  const ready = loadedKey === key;

  useEffect(() => {
    let cancelled = false;
    const finish = (next: GameList[]) => {
      if (cancelled) return;
      rememberCovers(next.flatMap((l) => l.items.map((i) => i.game)));
      listsRef.current = next;
      setLists(next);
      setLoadedKey(key);
    };

    if (!userId) {
      finish(readLocalLists());
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const sb = createClient();
      if (!sb) return finish([]);
      const { data: listRows, error } = await sb
        .from("lists")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        onError(`Couldn't load your lists: ${error.message}`);
        return finish([]);
      }
      const rows = (listRows ?? []) as ListRow[];
      const itemsByList = new Map<string, ItemRow[]>();
      if (rows.length > 0) {
        const { data: itemRows, error: itemsError } = await sb
          .from("list_items")
          .select("*")
          .in("list_id", rows.map((r) => r.id))
          .order("position", { ascending: true });
        if (cancelled) return;
        if (itemsError) onError(`Couldn't load list items: ${itemsError.message}`);
        for (const r of (itemRows ?? []) as ItemRow[]) {
          itemsByList.set(r.list_id, [...(itemsByList.get(r.list_id) ?? []), r]);
        }
      }
      finish(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description ?? "",
          isRanked: Boolean(r.is_ranked),
          isPublic: r.is_public !== false,
          items: (itemsByList.get(r.id) ?? []).map((i) => ({ game: cleanGame(i.game_data), note: i.note ?? "" })),
          createdAt: Date.parse(r.created_at ?? "") || Date.now(),
          updatedAt: Date.parse(r.updated_at ?? "") || Date.now(),
        })),
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId && loadedKey === "local") writeLocal(LISTS_KEY, lists);
  }, [lists, userId, loadedKey]);

  // Same as the shelf: when a cover resolves, store it on matching list games in memory so they
  // carry it (persisted with the list's next save; no write to Supabase just for this).
  useEffect(
    () =>
      onCoverKnown((id, url) => {
        let changed = false;
        const next = listsRef.current.map((l) => {
          if (!l.items.some((i) => i.game.id === id && !i.game.thumbnail && !i.game.image)) return l;
          changed = true;
          return {
            ...l,
            items: l.items.map((i) =>
              i.game.id === id && !i.game.thumbnail && !i.game.image ? { ...i, game: { ...i.game, thumbnail: url } } : i,
            ),
          };
        });
        if (!changed) return;
        listsRef.current = next;
        setLists(next);
      }),
    [],
  );

  const commit = useCallback((next: GameList[]) => {
    listsRef.current = next;
    setLists(next);
  }, []);

  /** Create or replace a list (metadata, items and order). */
  const saveList = useCallback(
    (list: GameList) => {
      if (!ready) return;
      const stamped = { ...list, updatedAt: Date.now() };
      const exists = listsRef.current.some((l) => l.id === list.id);
      commit(exists ? listsRef.current.map((l) => (l.id === list.id ? stamped : l)) : [stamped, ...listsRef.current]);
      if (userId) {
        void persistList(userId, stamped).then((err) => {
          if (err) onError(`Couldn't sync your list: ${err}`);
        });
      }
    },
    [ready, userId, commit, onError],
  );

  const deleteList = useCallback(
    (id: string) => {
      if (!ready) return;
      commit(listsRef.current.filter((l) => l.id !== id));
      if (userId) {
        const sb = createClient();
        void Promise.resolve(sb?.from("lists").delete().eq("id", id).eq("user_id", userId)).then((res) => {
          if (res?.error) onError(`Couldn't delete the list: ${res.error.message}`);
        });
      }
    },
    [ready, userId, commit, onError],
  );

  /** One-tap add of a game to the end of an existing list. Returns false if it was already there. */
  const addToList = useCallback(
    (listId: string, game: Game): boolean => {
      if (!ready) return false;
      const list = listsRef.current.find((l) => l.id === listId);
      if (!list || list.items.some((i) => i.game.id === game.id)) return false;
      const updated: GameList = { ...list, items: [...list.items, { game, note: "" }], updatedAt: Date.now() };
      commit(listsRef.current.map((l) => (l.id === listId ? updated : l)));
      if (userId && numericId(game)) {
        const sb = createClient();
        void (async () => {
          const { error } = (await sb?.from("list_items").upsert(
            { list_id: listId, bgg_id: Number(game.id), game_data: game, note: "", position: list.items.length },
            { onConflict: "list_id,bgg_id", ignoreDuplicates: true },
          )) ?? { error: { message: "Supabase isn't configured." } };
          if (error) onError(`Couldn't add to the list: ${error.message}`);
          else await sb?.from("lists").update({ updated_at: new Date().toISOString() }).eq("id", listId);
        })();
      }
      return true;
    },
    [ready, userId, commit, onError],
  );

  /** Bulk-add lists (used when importing this device's data into an account). */
  const importLists = useCallback(
    async (incoming: GameList[]): Promise<string | null> => {
      if (!ready) return "Not ready yet.";
      const ids = new Set(incoming.map((l) => l.id));
      commit([...incoming, ...listsRef.current.filter((l) => !ids.has(l.id))]);
      if (!userId) return null;
      for (const list of incoming) {
        const err = await persistList(userId, list);
        if (err) return err;
      }
      return null;
    },
    [ready, userId, commit],
  );

  return { lists, ready, saveList, deleteList, addToList, importLists };
}

export type ListsState = ReturnType<typeof useLists>;
