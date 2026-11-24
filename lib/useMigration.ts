"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, Shelf, ShelfEntry } from "./types";
import { clearLocalData, readLocalShelf, readLocalTopFour } from "./localData";

const dismissKey = (userId: string) => `tabletopd_migration_dismissed_${userId}`;

interface Args {
  userId: string | null;
  shelf: Shelf;
  shelfReady: boolean;
  importEntries: (entries: ShelfEntry[]) => Promise<string | null>;
  topSlots: (Game | null)[];
  topReady: boolean;
  replaceTopFour: (slots: (Game | null)[]) => Promise<string | null>;
  onError: (message: string) => void;
}

export interface MigrationOffer {
  games: number;
  favorites: number;
  entries: ShelfEntry[];
  slots: (Game | null)[];
}

/**
 * After sign-in, if this device holds shelf data or Top 4 picks and the
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
    if (!a.shelfReady || !a.topReady || checkedFor.current === a.userId) return;
    checkedFor.current = a.userId;

    try {
      if (localStorage.getItem(dismissKey(a.userId))) return;
    } catch {
      /* treat as not dismissed */
    }

    const cloudEmpty = Object.keys(a.shelf).length === 0 && a.topSlots.every((g) => !g);
    if (!cloudEmpty) return;

    const entries = Object.values(readLocalShelf());
    const slots = readLocalTopFour();
    const favorites = slots.filter(Boolean).length;
    if (entries.length === 0 && favorites === 0) return;
    setOffer({ games: entries.length, favorites, entries, slots });
  }, [a.userId, a.shelfReady, a.topReady, a.shelf, a.topSlots]);

  const accept = useCallback(async () => {
    if (!offer) return;
    setBusy(true);
    const [e1, e2] = await Promise.all([
      offer.entries.length ? a.importEntries(offer.entries) : Promise.resolve(null),
      offer.favorites ? a.replaceTopFour(offer.slots) : Promise.resolve(null),
    ]);
    setBusy(false);
    const err = e1 ?? e2;
    if (err) {
      a.onError(`Import failed: ${err}. Your data is still on this device.`);
      return;
    }
    clearLocalData();
    setOffer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer, a.importEntries, a.replaceTopFour, a.onError]);

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
