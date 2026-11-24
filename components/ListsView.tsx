"use client";

import { useState } from "react";
import { ArrowLeft, Check, Globe, Link2, ListOrdered, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import type { Game, GameList } from "@/lib/types";
import type { ListsState } from "@/lib/useLists";
import { Poster } from "./GameCard";
import ListEditor from "./ListEditor";

/** Compact card: title, counts and a fan of the first few posters. Also used on the Profile tab. */
export function ListSummaryCard({ list, onClick }: { list: GameList; onClick: () => void }) {
  const preview = list.items.slice(0, 4);
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-emerald/60"
    >
      <div className="flex h-[76px] items-center">
        {preview.length === 0 ? (
          <div className="flex h-full w-14 items-center justify-center rounded border border-dashed border-line text-muted">
            <Plus size={16} />
          </div>
        ) : (
          preview.map((it, i) => (
            <Poster
              key={it.game.id}
              game={it.game}
              // overlap the posters like a fanned stack of boxes
              className={`h-[76px] w-14 flex-none rounded border border-surface shadow-md ${i > 0 ? "-ml-4" : ""}`}
            />
          ))
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">{list.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>
            {list.items.length} {list.items.length === 1 ? "game" : "games"}
          </span>
          {list.isRanked && (
            <span className="inline-flex items-center gap-1 text-emerald">
              <ListOrdered size={11} /> Ranked
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            {list.isPublic ? <Globe size={11} /> : <Lock size={11} />}
            {list.isPublic ? "Public" : "Private"}
          </span>
        </p>
      </div>
    </button>
  );
}

interface Props {
  listsState: ListsState;
  signedIn: boolean;
  /** Id of the list being viewed (controlled by the page so Profile can deep-link here). */
  openId: string | null;
  onOpen: (id: string | null) => void;
  onLog: (g: Game) => void;
}

export default function ListsView({ listsState, signedIn, openId, onOpen, onLog }: Props) {
  const { lists, saveList, deleteList } = listsState;
  const [editing, setEditing] = useState<GameList | "new" | null>(null);
  const [copied, setCopied] = useState(false);

  const open = lists.find((l) => l.id === openId) ?? null;

  const share = async (list: GameList) => {
    const url = `${window.location.origin}/lists/${list.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const editor = editing && (
    <ListEditor
      initial={editing === "new" ? null : editing}
      signedIn={signedIn}
      onSave={(l) => {
        saveList(l);
        onOpen(l.id);
      }}
      onClose={() => setEditing(null)}
    />
  );

  /* ---------------------------- single list view ---------------------------- */
  if (open) {
    return (
      <section>
        <button onClick={() => onOpen(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
          <ArrowLeft size={15} /> All lists
        </button>

        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white">{open.title}</h2>
            {open.description && <p className="mt-1 max-w-prose text-sm text-white/70">{open.description}</p>}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
              <span>
                {open.items.length} {open.items.length === 1 ? "game" : "games"}
              </span>
              {open.isRanked && <span className="text-emerald">Ranked</span>}
              <span>{open.isPublic ? "Public" : "Private"}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {signedIn && open.isPublic && (
              <button
                onClick={() => share(open)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-white/80 hover:border-emerald hover:text-emerald"
              >
                {copied ? <Check size={14} /> : <Link2 size={14} />} {copied ? "Link copied" : "Share"}
              </button>
            )}
            <button
              onClick={() => setEditing(open)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-white/80 hover:border-emerald hover:text-emerald"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete "${open.title}"? This can't be undone.`)) {
                  deleteList(open.id);
                  onOpen(null);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-white/80 hover:border-red-400 hover:text-red-300"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {!signedIn && (
          <p className="mb-4 rounded-md border border-line px-3 py-2 text-xs text-muted">
            Saved on this device. Sign in to sync this list and share it by link.
          </p>
        )}

        {open.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted">
            This list is empty. Use Edit to add games.
          </p>
        ) : (
          <ol className="space-y-2">
            {open.items.map((it, i) => (
              <li key={it.game.id}>
                <button
                  onClick={() => onLog(it.game)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-2.5 text-left transition hover:border-emerald/60"
                >
                  {open.isRanked && (
                    <span className="w-9 flex-none text-center text-xl font-extrabold text-emerald">#{i + 1}</span>
                  )}
                  <Poster game={it.game} className="h-20 w-14 flex-none rounded" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">{it.game.name}</span>
                    <span className="text-xs text-muted">{it.game.yearPublished ?? "—"}</span>
                    {it.note && <span className="mt-1 block text-sm text-white/75">{it.note}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {editor}
      </section>
    );
  }

  /* ------------------------------- all lists ------------------------------- */
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {lists.length} {lists.length === 1 ? "list" : "lists"}
        </p>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald px-4 py-1.5 text-sm font-bold text-bg transition hover:brightness-110"
        >
          <Plus size={15} /> New list
        </button>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-14 text-center">
          <p className="font-semibold text-white">Make your first list</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Curate games like &ldquo;Fav 2-Player Games&rdquo;, &ldquo;Travel Games&rdquo; or &ldquo;Pub Night Hits&rdquo;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <ListSummaryCard key={l.id} list={l} onClick={() => onOpen(l.id)} />
          ))}
        </div>
      )}
      {editor}
    </section>
  );
}
