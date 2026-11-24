"use client";

import { Loader2 } from "lucide-react";
import type { MigrationOffer } from "@/lib/useMigration";

interface Props {
  offer: MigrationOffer;
  busy: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function MigrationModal({ offer, busy, onAccept, onDismiss }: Props) {
  const parts = [
    offer.games > 0 && `${offer.games} ${offer.games === 1 ? "game" : "games"} on your shelf`,
    offer.favorites > 0 && `${offer.favorites} Top 4 ${offer.favorites === 1 ? "favorite" : "favorites"}`,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import your saved games"
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-2 text-lg font-bold text-white">Import your saved games?</h2>
        <p className="mb-5 text-sm text-muted">
          This device has {parts.join(" and ")}. Import {parts.length > 1 ? "them" : "it"} into your account so{" "}
          {parts.length > 1 ? "they sync" : "it syncs"} everywhere.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onDismiss}
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm text-muted hover:text-white disabled:opacity-50"
          >
            Not now
          </button>
          <button
            onClick={onAccept}
            disabled={busy}
            className="flex items-center gap-2 rounded-md bg-emerald px-5 py-2 text-sm font-bold text-bg hover:brightness-110 disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
