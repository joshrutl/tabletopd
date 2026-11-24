"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { Game, SearchResponse } from "@/lib/types";
import { Poster, playerLabel } from "./GameCard";

interface Props {
  /** Games already sitting in the other slots; these can't be picked again. */
  takenIds: Set<string>;
  onPick: (g: Game) => void;
  onClose: () => void;
}

/** Search the whole catalogue (not just the shelf) for a favourite. */
export default function FavoritePickerModal({ takenIds, onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Empty query returns the popular feed, so the list is pre-populated on open.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bgg/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        setGames(((await res.json()) as SearchResponse).games);
        setError(null);
        setLoading(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pick a favorite game"
        className="sheet-enter flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line p-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all board games…"
              aria-label="Search all board games"
              className="w-full rounded-full border border-line bg-bg py-2 pl-9 pr-9 text-sm text-white placeholder:text-muted focus:border-emerald focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted hover:bg-line hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="p-3 text-sm text-red-300">{error}</p>}
          {!loading && !error && games.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">No games found.</p>
          )}
          {loading && games.length === 0 && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-emerald" />
            </div>
          )}
          <ul className="space-y-1.5">
            {games.map((g) => {
              const taken = takenIds.has(g.id);
              return (
                <li key={g.id}>
                  <button
                    disabled={taken}
                    onClick={() => onPick(g)}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left transition enabled:hover:border-emerald/60 enabled:hover:bg-bg/60 disabled:opacity-40"
                  >
                    <Poster game={g} className="h-14 w-10 flex-none rounded" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">{g.name}</span>
                      <span className="text-xs text-muted">
                        {g.yearPublished ?? "—"}
                        {g.maxPlayers > 0 && ` · ${playerLabel(g)}`}
                      </span>
                    </span>
                    {taken && <span className="text-xs text-amber">In your Top 4</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
