"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, GameList, Shelf, ShelfEntry } from "./types";
import { clearLocalData, readLocalLists, readLocalShelf, readLocalTopFour } from "./localData";

const dismissKey = (userId: string) => `tabletopd_migration_dismissed_${userId}`;

interface Args {
  userId: string | null;
  shelf: Shelf;
  shelfReady: boolean;
  importEntries: (entries: ShelfEntry[]) => Promise<string | null>;
  topSlots: (Game | null)[];
  topReady: boolean;
  replaceTopFour: (slots: (Game | null)[]) => Promise<string | null>;
  lists: GameList[];
  listsReady: boolean;
  importLists: (lists: GameList[]) => Promise<string | null>;
  onError: (message: string) => void;
}

export interface MigrationOffer {
  games: number;
  favorites: number;
  listCount: number;
  entries: ShelfEntry[];
  slots: (Game | null)[];
  lists: GameList[];
}

/**
 * After sign-in, if this device holds shelf data, Top 4 picks or lists and the
 * account's cloud data is empty, offer to import it once.
 */
export function useMigration(a: Args) {
  const [offer, setOffer] = useState<MigrationOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const checkedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!a.userId) {
      checkedFor.current = null;
      setOffer(null);
      return;
    }
    if (!a.shelfReady || !a.topReady || !a.listsReady || checkedFor.current === a.userId) return;
    checkedFor.current = a.userId;

    try {
      if (localStorage.getItem(dismissKey(a.userId))) return;
    } catch {
      /* treat as not dismissed */
    }

    const cloudEmpty =
      Object.keys(a.shelf).length === 0 && a.topSlots.every((g) => !g) && a.lists.length === 0;
    if (!cloudEmpty) return;

    const entries = Object.values(readLocalShelf());
    const slots = readLocalTopFour();
    const lists = readLocalLists();
    const favorites = slots.filter(Boolean).length;
    if (entries.length === 0 && favorites === 0 && lists.length === 0) return;
    setOffer({ games: entries.length, favorites, listCount: lists.length, entries, slots, lists });
  }, [a.userId, a.shelfReady, a.topReady, a.listsReady, a.shelf, a.topSlots, a.lists]);

  const accept = useCallback(async () => {
    if (!offer) return;
    setBusy(true);
    const results = await Promise.all([
      offer.entries.length ? a.importEntries(offer.entries) : Promise.resolve(null),
      offer.favorites ? a.replaceTopFour(offer.slots) : Promise.resolve(null),
      offer.lists.length ? a.importLists(offer.lists) : Promise.resolve(null),
    ]);
    setBusy(false);
    const err = results.find((r) => r !== null);
    if (err) {
      a.onError(`Import failed: ${err}. Your data is still on this device.`);
      return;
    }
    clearLocalData();
    setOffer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer, a.importEntries, a.replaceTopFour, a.importLists, a.onError]);

  const dismiss = useCallback(() => {
    try {
      if (a.userId) localStorage.setItem(dismissKey(a.userId), "1");
    } catch {
      /* ignore */
    }
    setOffer(null);
  }, [a.userId]);

  return { offer, busy, accept, dismiss };
}
