"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, Search, X } from "lucide-react";
import type { Game, GameList, ListItem, SearchResponse } from "@/lib/types";
import { Poster } from "./GameCard";

interface Props {
  /** The list being edited, or null to create a new one. */
  initial: GameList | null;
  signedIn: boolean;
  onSave: (list: GameList) => void;
  onClose: () => void;
}

const MAX_ITEMS = 200;

export default function ListEditor({ initial, signedIn, onSave, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isRanked, setIsRanked] = useState(initial?.isRanked ?? false);
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [items, setItems] = useState<ListItem[]>(initial?.items ?? []);

  // Search-to-add panel
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [searching, setSearching] = useState(false);

  // Drag and drop
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Debounced catalogue search (empty query = popular games).
  useEffect(() => {
    const controller = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bgg/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error();
        setResults(((await res.json()) as SearchResponse).games);
        setSearching(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const inList = new Set(items.map((i) => i.game.id));

  const add = (game: Game) => {
    if (inList.has(game.id) || items.length >= MAX_ITEMS) return;
    setItems((s) => [...s, { game, note: "" }]);
  };
  const remove = (i: number) => setItems((s) => s.filter((_, idx) => idx !== i));
  const setNote = (i: number, note: string) =>
    setItems((s) => s.map((it, idx) => (idx === i ? { ...it, note: note.slice(0, 200) } : it)));
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    setItems((s) => {
      const next = [...s];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const canSave = title.trim().length > 0;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const now = Date.now();
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim().slice(0, 80),
      description: description.trim().slice(0, 500),
      isRanked,
      isPublic,
      items,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
    onClose();
  };

  const label = "block text-xs font-semibold uppercase tracking-wider text-muted";
  const field =
    "mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm normal-case text-white placeholder:text-muted/60 focus:border-emerald focus:outline-none";
  const toggle = (on: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
      on ? "border-emerald bg-emerald/15 text-emerald" : "border-line text-muted hover:text-white"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Edit list" : "Create list"}
        className="sheet-enter flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-white">{initial ? "Edit list" : "New list"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted hover:bg-line hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <label className={label}>
            Title
            <input
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Fav 2-Player Games"
              autoFocus={!initial}
              required
            />
          </label>

          <label className={label}>
            Description
            <textarea
              className={`${field} resize-none`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="What ties these games together?"
            />
          </label>

          <div className="flex gap-2">
            <button type="button" aria-pressed={isRanked} onClick={() => setIsRanked((v) => !v)} className={toggle(isRanked)}>
              Ranked list
            </button>
            <button type="button" aria-pressed={isPublic} onClick={() => setIsPublic((v) => !v)} className={toggle(isPublic)}>
              {isPublic ? "Public" : "Private"}
            </button>
          </div>
          {!signedIn && (
            <p className="-mt-3 text-xs text-muted">
              You&apos;re signed out, so this list is saved on this device only. Sign in to sync it and share it by link.
            </p>
          )}

          {/* Items */}
          <section>
            <h3 className={`${label} mb-2`}>
              Games <span className="text-white/60">({items.length})</span>
            </h3>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-muted">
                No games yet. Search below to add some.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((it, i) => (
                  <li
                    key={it.game.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(i));
                      setDragFrom(i);
                    }}
                    onDragOver={(e) => {
                      if (dragFrom === null) return;
                      e.preventDefault();
                      setDragOver(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom !== null) move(dragFrom, i);
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={`flex items-start gap-2 rounded-lg border bg-bg/60 p-2 transition ${
                      dragOver === i && dragFrom !== null && dragFrom !== i ? "border-emerald" : "border-line"
                    } ${dragFrom === i ? "opacity-40" : ""}`}
                  >
                    <GripVertical size={16} className="mt-3 flex-none cursor-grab text-muted" aria-hidden />
                    {isRanked && (
                      <span className="mt-2.5 w-7 flex-none text-center text-sm font-extrabold text-emerald">#{i + 1}</span>
                    )}
                    <Poster game={it.game} className="pointer-events-none h-14 w-10 flex-none rounded" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{it.game.name}</p>
                      <input
                        value={it.note}
                        onChange={(e) => setNote(i, e.target.value)}
                        placeholder="Add a note (optional)"
                        aria-label={`Note for ${it.game.name}`}
                        maxLength={200}
                        className="mt-1 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-white/80 placeholder:text-muted/60 hover:border-line focus:border-emerald focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-none flex-col">
                      <button
                        type="button"
                        onClick={() => move(i, i - 1)}
                        disabled={i === 0}
                        aria-label={`Move ${it.game.name} up`}
                        className="rounded p-1 text-muted hover:bg-line hover:text-white disabled:pointer-events-none disabled:opacity-25"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, i + 1)}
                        disabled={i === items.length - 1}
                        aria-label={`Move ${it.game.name} down`}
                        className="rounded p-1 text-muted hover:bg-line hover:text-white disabled:pointer-events-none disabled:opacity-25"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={`Remove ${it.game.name}`}
                      className="mt-1 flex-none rounded-full p-1.5 text-muted hover:bg-red-500/20 hover:text-red-300"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Add games */}
          <section>
            <h3 className={`${label} mb-2`}>Add games</h3>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all board games…"
                aria-label="Search games to add"
                className="w-full rounded-full border border-line bg-bg py-2 pl-9 pr-9 text-sm text-white placeholder:text-muted focus:border-emerald focus:outline-none"
              />
              {searching && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald" />
              )}
            </div>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {results.map((g) => {
                const added = inList.has(g.id);
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => add(g)}
                      className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition enabled:hover:bg-bg/70 disabled:opacity-50"
                    >
                      <Poster game={g} className="h-10 w-7 flex-none rounded" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{g.name}</span>
                        <span className="text-xs text-muted">{g.yearPublished ?? "—"}</span>
                      </span>
                      {added ? (
                        <span className="text-xs text-emerald">Added</span>
                      ) : (
                        <Plus size={16} className="flex-none text-emerald" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line p-4">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-md bg-emerald px-5 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-40"
          >
            {initial ? "Save list" : "Create list"}
          </button>
        </footer>
      </form>
    </div>
  );
}
