"use client";

import { useEffect, useMemo, useState } from "react";
import { Dices, Loader2 } from "lucide-react";
import type { Game, SearchResponse, Shelf } from "@/lib/types";
import { matchesFilter, PLAYER_OPTIONS, TIME_OPTIONS } from "@/lib/filters";
import GameCard, { type CardHandlers } from "./GameCard";
import GameGrid from "./GameGrid";
import { Chip } from "./FilterPanel";

interface Props extends CardHandlers {
  shelf: Shelf;
}

/** Pick a game for tonight by headcount and time available. */
export default function GameNightView({ shelf, ...handlers }: Props) {
  const [players, setPlayers] = useState(4);
  const [maxTime, setMaxTime] = useState<number | null>(60);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [remote, setRemote] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const owned = useMemo(
    () => Object.values(shelf).filter((e) => e.owned).map((e) => e.game),
    [shelf],
  );

  useEffect(() => {
    if (ownedOnly) return;
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ q: "", sort: "popular", players: String(players) });
    if (maxTime) params.set("maxTime", String(maxTime));
    fetch(`/api/bgg/search?${params}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<SearchResponse>)
      .then((data) => {
        setRemote(data.games);
        setLoading(false);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setLoading(false);
      });
    return () => controller.abort();
  }, [players, maxTime, ownedOnly]);

  const results = useMemo(
    () => (ownedOnly ? owned.filter((g) => matchesFilter(g, { players, maxTime })) : remote),
    [ownedOnly, owned, remote, players, maxTime],
  );

  // A pick that no longer fits the filters is dropped.
  const picked = results.find((g) => g.id === pickedId) ?? null;

  const pickOne = () => {
    if (results.length === 0) return;
    const pool = results.length > 1 ? results.filter((g) => g.id !== pickedId) : results;
    setPickedId(pool[Math.floor(Math.random() * pool.length)].id);
  };

  const heading = "mb-2 text-xs font-semibold uppercase tracking-widest text-muted";

  return (
    <section>
      <h1 className="mb-1 text-xl font-bold text-white">Game Night</h1>
      <p className="mb-5 text-sm text-muted">Tell us who&apos;s playing and how long you&apos;ve got.</p>

      <div className="mb-5 rounded-xl border border-line bg-surface p-4">
        <h2 className={heading}>Players</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {PLAYER_OPTIONS.map((n) => (
            <Chip key={n} active={players === n} onClick={() => setPlayers(n)}>
              {n}
            </Chip>
          ))}
        </div>

        <h2 className={heading}>Time available</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip active={maxTime === null} onClick={() => setMaxTime(null)}>
            Any
          </Chip>
          {TIME_OPTIONS.map((t) => (
            <Chip key={t.value} active={maxTime === t.value} onClick={() => setMaxTime(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={ownedOnly}
            onChange={(e) => setOwnedOnly(e.target.checked)}
            className="accent-emerald"
          />
          Only games I own ({owned.length})
        </label>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={pickOne}
          disabled={results.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-emerald px-5 py-2.5 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-40"
        >
          <Dices size={18} /> {picked ? "Pick another" : "Pick one for me"}
        </button>
        <span className="flex items-center gap-2 text-sm text-muted">
          {loading && <Loader2 size={14} className="animate-spin text-emerald" />}
          {results.length} {results.length === 1 ? "game fits" : "games fit"}
        </span>
      </div>

      {picked && (
        <div className="mb-8 flex flex-col items-start gap-2">
          <h2 className={heading}>Tonight&apos;s pick</h2>
          <div className="w-48 rounded-xl ring-2 ring-emerald">
            <GameCard game={picked} entry={shelf[picked.id]} {...handlers} />
          </div>
        </div>
      )}

      {!loading && results.length === 0 ? (
        <p className="py-12 text-center text-muted">
          {ownedOnly
            ? "None of your owned games fit. Mark more games as owned, or loosen the filters."
            : "No games fit. Try a longer time limit."}
        </p>
      ) : (
        <GameGrid games={results} shelf={shelf} {...handlers} />
      )}
    </section>
  );
}
