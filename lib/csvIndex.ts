import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { Game, SortId } from "./types";
import { MOCK_BY_ID } from "./mockGames";
import { decodeHtmlEntities } from "./text";
import { matchesFilter, NO_FILTER, type GameFilter } from "./filters";

interface Row {
  id: string;
  name: string;
  yearpublished: string;
  rank: string;
  bayesaverage: string;
  average: string;
  usersrated: string;
  is_expansion: string;
  abstracts_rank: string;
  cgs_rank: string;
  childrensgames_rank: string;
  familygames_rank: string;
  partygames_rank: string;
  strategygames_rank: string;
  thematic_rank: string;
  wargames_rank: string;
}

interface Indexed {
  game: Game;
  lower: string;
  rank: number; // overall BGG rank, 0 = unranked
  bayes: number;
  usersRated: number;
  /** Best rank among the approachable categories (family/abstract/party); Infinity if none. */
  easyRank: number;
  /** Best rank among the heavier categories (strategy/thematic/wargames); Infinity if none. */
  heavyRank: number;
}

const CSV_PATH = path.join(process.cwd(), "data", "boardgames_ranks.csv");

// Cached on globalThis so dev-mode hot reloads don't re-parse 11 MB each time.
const g = globalThis as unknown as { __bggCsvIndex?: Indexed[] | null };

const rk = (v: string | undefined): number => {
  const n = Number(v);
  return n > 0 ? n : Infinity;
};

/**
 * Player count / playtime guess for games missing from the curated list,
 * based on whichever category sub-rank is best.
 */
function estimate(r: Row): { min: number; max: number; time: number } {
  const cats: { rank: number; min: number; max: number; time: number }[] = [
    { rank: rk(r.partygames_rank), min: 3, max: 8, time: 20 },
    { rank: rk(r.abstracts_rank), min: 2, max: 4, time: 30 },
    { rank: rk(r.familygames_rank), min: 2, max: 4, time: 45 },
    { rank: rk(r.childrensgames_rank), min: 2, max: 4, time: 20 },
    { rank: rk(r.strategygames_rank), min: 2, max: 4, time: 90 },
    { rank: rk(r.thematic_rank), min: 2, max: 4, time: 90 },
    { rank: rk(r.wargames_rank), min: 2, max: 2, time: 120 },
    { rank: rk(r.cgs_rank), min: 2, max: 4, time: 45 },
  ];
  const best = cats.reduce((a, b) => (b.rank < a.rank ? b : a));
  return Number.isFinite(best.rank) ? best : { min: 2, max: 4, time: 60 };
}

/** Parsed CSV index, or null if the file is missing. Parsed once per process. */
export function getCsvIndex(): Indexed[] | null {
  if (g.__bggCsvIndex !== undefined) return g.__bggCsvIndex;

  if (!fs.existsSync(CSV_PATH)) {
    g.__bggCsvIndex = null;
    return null;
  }

  const parsed = Papa.parse<Row>(fs.readFileSync(CSV_PATH, "utf8"), {
    header: true,
    skipEmptyLines: true,
  });

  const index: Indexed[] = [];
  for (const r of parsed.data) {
    if (!r.id || !r.name || r.is_expansion === "1") continue;

    const known = MOCK_BY_ID.get(r.id);
    const year = Number(r.yearpublished);
    const avg = Number(r.average);
    const est = known ? null : estimate(r);

    const game: Game = {
      id: r.id,
      name: known?.name ?? decodeHtmlEntities(r.name),
      yearPublished: year > 0 ? year : (known?.yearPublished ?? null),
      thumbnail: known?.thumbnail ?? null,
      image: known?.image ?? null,
      minPlayers: known?.minPlayers ?? est!.min,
      maxPlayers: known?.maxPlayers ?? est!.max,
      playingTime: known?.playingTime ?? est!.time,
      rating: avg > 0 ? Math.round(avg * 10) / 10 : (known?.rating ?? null),
      ...(est ? { estimated: true } : {}),
    };

    index.push({
      game,
      lower: game.name.toLowerCase(),
      rank: Number(r.rank) || 0,
      bayes: Number(r.bayesaverage) || 0,
      usersRated: Number(r.usersrated) || 0,
      easyRank: Math.min(rk(r.familygames_rank), rk(r.abstracts_rank), rk(r.partygames_rank)),
      heavyRank: Math.min(rk(r.strategygames_rank), rk(r.thematic_rank), rk(r.wargames_rank)),
    });
  }
  g.__bggCsvIndex = index;
  return index;
}

const CURRENT_YEAR = new Date().getFullYear();

/** "Popular & Approachable" score: popularity, nudged up by how high it ranks in its easy category. */
const popularScore = (i: Indexed) => i.usersRated / (1 + i.easyRank / 200);

/** Approachable = top-300 in family/abstract/party, and not better ranked as a heavy game. */
const isApproachable = (i: Indexed) => i.easyRank <= 300 && i.easyRank <= i.heavyRank;

function comparator(sort: SortId): (a: Indexed, b: Indexed) => number {
  switch (sort) {
    case "rated":
      return (a, b) => b.usersRated - a.usersRated;
    case "highest":
      return (a, b) => b.bayes - a.bayes;
    case "newest":
      return (a, b) =>
        (b.game.yearPublished ?? 0) - (a.game.yearPublished ?? 0) || b.usersRated - a.usersRated;
    default:
      return (a, b) => popularScore(b) - popularScore(a);
  }
}

/**
 * Local search. With no query, returns a browse feed for the chosen sort
 * ("popular" is limited to approachable family/abstract/party games; the other
 * sorts rank the whole catalogue). With a query, results are ordered by name
 * match quality (exact > prefix > word-start > substring), then by the sort.
 */
export function searchCsv(
  query: string,
  sort: SortId,
  limit: number,
  filter: GameFilter = NO_FILTER,
): Game[] {
  const idx = (getCsvIndex() ?? []).filter((i) => matchesFilter(i.game, filter));
  const q = query.trim().toLowerCase();
  const cmp = comparator(sort);

  if (!q) {
    let pool: Indexed[];
    switch (sort) {
      case "popular":
        pool = idx.filter(isApproachable);
        break;
      case "newest":
        // Recent releases that have enough ratings to be real, not placeholders.
        pool = idx.filter(
          (i) => i.usersRated >= 500 && (i.game.yearPublished ?? 0) <= CURRENT_YEAR,
        );
        break;
      default:
        pool = idx.filter((i) => i.rank > 0);
    }
    return pool.sort(cmp).slice(0, limit).map((i) => i.game);
  }

  const scored: { item: Indexed; tier: number }[] = [];
  for (const item of idx) {
    // Ignore a leading article so "quacks" counts as a prefix of "The Quacks of Quedlinburg".
    const name = item.lower.replace(/^(the|a|an) /, "");
    const pos = name.indexOf(q);
    if (pos < 0) {
      if (!item.lower.includes(q)) continue;
      scored.push({ item, tier: 3 });
      continue;
    }
    let tier = 3;
    if (name === q || item.lower === q) tier = 0;
    else if (pos === 0) tier = 1;
    else if (/[\s:\-]/.test(name[pos - 1])) tier = 2;
    scored.push({ item, tier });
  }

  // Under the default sort, rank within a tier by raw popularity (usersrated).
  const within = sort === "popular" ? (a: Indexed, b: Indexed) => b.usersRated - a.usersRated : cmp;
  scored.sort((a, b) => a.tier - b.tier || within(a.item, b.item));
  return scored.slice(0, limit).map((s) => s.item.game);
}
