"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { SortId } from "@/lib/types";
import {
  NO_FILTER,
  PLAYER_OPTIONS,
  SORT_OPTIONS,
  TIME_OPTIONS,
  type GameFilter,
} from "@/lib/filters";

interface Props {
  sort: SortId;
  onSort: (s: SortId) => void;
  filter: GameFilter;
  onFilter: (f: GameFilter) => void;
  /** False when live BGG results are showing (they can't be re-sorted). */
  sortApplies: boolean;
  onClose: () => void;
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-emerald bg-emerald/15 text-emerald"
          : "border-line text-muted hover:border-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** Slide-up sheet (centered dialog on wide screens) for sort order and exact filters. */
export default function FilterPanel({ sort, onSort, filter, onFilter, sortApplies, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const heading = "mb-2 text-xs font-semibold uppercase tracking-widest text-muted";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sort and filter"
        className="sheet-enter max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-8 shadow-2xl sm:rounded-2xl sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Sort &amp; Filter</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted hover:bg-line hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <section className="mb-5">
          <h3 className={heading}>Sort order</h3>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((s) => (
              <Chip key={s.id} active={sort === s.id} onClick={() => onSort(s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
          {!sortApplies && (
            <p className="mt-2 text-xs text-muted">Live BGG results keep BGG&apos;s own relevance order.</p>
          )}
        </section>

        <section className="mb-5">
          <h3 className={heading}>Player count</h3>
          <div className="flex flex-wrap gap-2">
            <Chip active={filter.players === null} onClick={() => onFilter({ ...filter, players: null })}>
              Any
            </Chip>
            {PLAYER_OPTIONS.map((n) => (
              <Chip
                key={n}
                active={filter.players === n}
                onClick={() => onFilter({ ...filter, players: filter.players === n ? null : n })}
              >
                {n}
              </Chip>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className={heading}>Max playtime</h3>
          <div className="flex flex-wrap gap-2">
            <Chip active={filter.maxTime === null} onClick={() => onFilter({ ...filter, maxTime: null })}>
              Any
            </Chip>
            {TIME_OPTIONS.map((t) => (
              <Chip
                key={t.value}
                active={filter.maxTime === t.value}
                onClick={() => onFilter({ ...filter, maxTime: filter.maxTime === t.value ? null : t.value })}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </section>

        <div className="flex justify-between gap-2">
          <button
            onClick={() => {
              onSort("popular");
              onFilter(NO_FILTER);
            }}
            className="rounded-md px-4 py-2 text-sm text-muted hover:text-white"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-emerald px-6 py-2 text-sm font-semibold text-bg transition hover:brightness-110"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
