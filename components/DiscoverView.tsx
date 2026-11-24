"use client";

import { useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import type { Shelf } from "@/lib/types";
import type { Discover } from "@/lib/useDiscover";
import { describeFilter, NO_FILTER, QUICK_MAX, SORT_HEADINGS } from "@/lib/filters";
import type { CardHandlers } from "./GameCard";
import GameGrid from "./GameGrid";
import FilterPanel, { Chip } from "./FilterPanel";

interface Props extends CardHandlers {
  d: Discover;
  shelf: Shelf;
}

export default function DiscoverView({ d, shelf, ...handlers }: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const { filter, setFilter, sort, query } = d;

  const noFilters = filter.players === null && filter.maxTime === null;
  const activeCount = (sort !== "popular" ? 1 : 0) + (filter.players !== null ? 1 : 0) + (filter.maxTime !== null ? 1 : 0);

  return (
    <section>
      {/* Compact, wrapping chips: no horizontal scrolling. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Chip active={noFilters} onClick={() => setFilter(NO_FILTER)}>
          All
        </Chip>
        <Chip
          active={filter.players === 2}
          onClick={() => setFilter({ ...filter, players: filter.players === 2 ? null : 2 })}
        >
          2-Player
        </Chip>
        <Chip
          active={filter.maxTime === QUICK_MAX}
          onClick={() => setFilter({ ...filter, maxTime: filter.maxTime === QUICK_MAX ? null : QUICK_MAX })}
        >
          Quick (&lt; 45m)
        </Chip>
        <button
          onClick={() => setPanelOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber/60 px-3.5 py-1.5 text-sm font-medium text-amber transition hover:bg-amber/10"
        >
          <SlidersHorizontal size={14} /> Sort &amp; Filter
          {activeCount > 0 && (
            <span className="rounded-full bg-amber px-1.5 text-xs font-bold text-bg">{activeCount}</span>
          )}
        </button>
        {d.loading && <Loader2 size={16} className="ml-auto animate-spin text-emerald" />}
      </div>

      <h1 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted">
        {[query.trim() ? `Results for “${query.trim()}”` : SORT_HEADINGS[sort], describeFilter(filter)]
          .filter(Boolean)
          .join(" · ")}
      </h1>

      {d.note && (
        <p className="mb-5 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">
          {d.note} Add a <code className="font-mono">BGG_API_TOKEN</code> to{" "}
          <code className="font-mono">.env.local</code> for live data.
        </p>
      )}
      {d.error && (
        <p className="mb-5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {d.error}
        </p>
      )}
      {!d.loading && d.games.length === 0 && !d.error && (
        <p className="py-20 text-center text-muted">No games match. Try another search or filter.</p>
      )}

      <GameGrid games={d.games} shelf={shelf} {...handlers} />

      {panelOpen && (
        <FilterPanel
          sort={sort}
          onSort={d.setSort}
          filter={filter}
          onFilter={setFilter}
          sortApplies={d.sortApplied}
          hotAvailable={d.hotAvailable}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </section>
  );
}
