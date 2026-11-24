"use client";

import { useEffect, useState } from "react";
import type { Game, SearchResponse, SortId } from "./types";
import { NO_FILTER, type GameFilter } from "./filters";

const DEBOUNCE_MS = 350;

/** State + debounced fetching for the Discover feed. Lives in the page so it survives tab switches. */
export function useDiscover() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>("popular");
  const [filter, setFilter] = useState<GameFilter>(NO_FILTER);
  const [games, setGames] = useState<Game[]>([]);
  const [source, setSource] = useState<SearchResponse["source"]>("local");
  const [note, setNote] = useState<string | undefined>();
  const [hotAvailable, setHotAvailable] = useState(false);
  const [sortApplied, setSortApplied] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ q: query.trim(), sort });
      if (filter.players) params.set("players", String(filter.players));
      if (filter.maxTime) params.set("maxTime", String(filter.maxTime));
      try {
        const res = await fetch(`/api/bgg/search?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as SearchResponse;
        setGames(data.games);
        setSource(data.source);
        setHotAvailable(Boolean(data.hotAvailable));
        setSortApplied(data.sortApplied !== false);
        setNote(data.source === "mock" ? data.note : undefined);
        setError(null);
        setLoading(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, sort, filter]);

  return {
    query,
    setQuery,
    sort,
    setSort,
    filter,
    setFilter,
    games,
    source,
    note,
    hotAvailable,
    sortApplied,
    loading,
    error,
  };
}

export type Discover = ReturnType<typeof useDiscover>;
