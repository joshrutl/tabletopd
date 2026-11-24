import { NextRequest, NextResponse, after } from "next/server";
import type { Game, SearchResponse, SortId } from "@/lib/types";
import { searchMockGames } from "@/lib/mockGames";
import { getCsvIndex, searchCsv } from "@/lib/csvIndex";
import { matchesFilter, NO_FILTER, type GameFilter } from "@/lib/filters";
import { BGG, bggFetch, getThings, thingToGame, toArray } from "@/lib/bgg";
import { imagesFromThings, saveImages } from "@/lib/bggImages";

export const dynamic = "force-dynamic";

const RESULTS = 24; // games returned per request
const SORTS: SortId[] = ["popular", "rated", "highest", "newest", "hot"];

// With a BGG token we rank from the local 25k-game catalogue, then pull live metadata
// (real player counts, playtimes, covers) for the games we're about to show.
const FILTER_CANDIDATES = 120; // catalogue games considered when a filter is active
const FILTER_ROUND = 40; // ...resolved against BGG this many at a time (2 /thing batches)

function intParam(req: NextRequest, key: string, min: number, max: number): number | null {
  const n = Number(req.nextUrl.searchParams.get(key));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Remember any covers BGG just returned in the shared Supabase cache (after the response is sent). */
function cacheCovers(fetched: Parameters<typeof imagesFromThings>[0]) {
  const rows = imagesFromThings(fetched);
  if (Object.keys(rows).length > 0) after(() => saveImages(rows));
}

/** Overlay live BGG metadata on catalogue games. Games BGG didn't answer for keep their estimates. */
async function enrich(games: Game[]): Promise<Game[]> {
  const { things, fetched } = await getThings(games.map((g) => g.id));
  cacheCovers(fetched);
  return games.map((g) => {
    const t = things.get(g.id);
    if (!t) return g;
    return {
      ...g,
      yearPublished: t.yearPublished ?? g.yearPublished,
      thumbnail: t.thumbnail ?? g.thumbnail,
      image: t.image ?? g.image,
      minPlayers: t.minPlayers,
      maxPlayers: t.maxPlayers,
      playingTime: t.playingTime,
      rating: t.rating ?? g.rating,
      estimated: undefined, // real numbers now
    };
  });
}

/** Resolve BGG hit ids into games (order preserved). */
async function liveGames(ids: string[]): Promise<Game[]> {
  const { things, fetched } = await getThings(ids);
  cacheCovers(fetched);
  return ids.flatMap((id) => (things.has(id) ? [thingToGame(things.get(id)!)] : []));
}

/** BGG's Hotness list: only used when the user explicitly picks "Hot on BGG". */
async function liveHot(limit: number): Promise<Game[]> {
  const data = (await bggFetch(`${BGG}/hot?type=boardgame`)) as { items?: { item?: unknown } };
  const ids = (toArray(data.items?.item) as Record<string, any>[]).map((i) => String(i["@_id"])).slice(0, limit);
  return liveGames(ids);
}

/** BGG's own name search, for titles our catalogue snapshot doesn't have. */
async function liveNameSearch(q: string, limit: number): Promise<Game[]> {
  const data = (await bggFetch(`${BGG}/search?query=${encodeURIComponent(q)}&type=boardgame`)) as {
    items?: { item?: unknown };
  };
  const ids = (toArray(data.items?.item) as Record<string, any>[]).map((i) => String(i["@_id"])).slice(0, limit);
  return liveGames(ids);
}

/**
 * Take catalogue candidates in rounds, enrich each round with real BGG data, and keep the games
 * that match the filter, until there are enough. Without a filter this is just the first page.
 */
async function pickAndEnrich(candidates: Game[], filter: GameFilter, filtering: boolean): Promise<Game[]> {
  const picked: Game[] = [];
  const round = filtering ? FILTER_ROUND : RESULTS;
  for (let i = 0; i < candidates.length && picked.length < RESULTS; i += round) {
    const enriched = await enrich(candidates.slice(i, i + round));
    picked.push(...enriched.filter((g) => matchesFilter(g, filter)));
    if (!filtering) break;
  }
  return picked.slice(0, RESULTS);
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sortParam = req.nextUrl.searchParams.get("sort");
  const sort: SortId = SORTS.includes(sortParam as SortId) ? (sortParam as SortId) : "popular";
  const filter: GameFilter = {
    players: intParam(req, "players", 1, 20),
    maxTime: intParam(req, "maxTime", 1, 1000),
  };
  const filtering = filter.players !== null || filter.maxTime !== null;
  const hasToken = Boolean(process.env.BGG_API_TOKEN);
  const csv = getCsvIndex();
  // "Hot on BGG" is a BGG feed, not a sort of our catalogue; everything else ranks the catalogue.
  const catalogueSort: SortId = sort === "hot" ? "popular" : sort;

  // No token: serve the local catalogue as-is (estimated player counts / times).
  if (!hasToken && csv) {
    const body: SearchResponse = {
      games: searchCsv(q, catalogueSort, RESULTS, filter),
      source: "local",
      note: "Searching the local BGG rankings dataset.",
      sortApplied: true,
      hotAvailable: false,
    };
    return NextResponse.json(body);
  }

  try {
    if (!hasToken) throw new Error("No BGG_API_TOKEN configured");

    // 1. Hot on BGG (explicit choice, no search text)
    if (sort === "hot" && !q) {
      const pool = await liveHot(filtering ? 50 : RESULTS);
      const games = pool.filter((g) => matchesFilter(g, filter)).slice(0, RESULTS);
      return NextResponse.json({ games, source: "bgg", sortApplied: false, hotAvailable: true } satisfies SearchResponse);
    }

    // 2. Full catalogue, ranked by the chosen sort, then enriched with live BGG data
    if (csv) {
      const candidates = searchCsv(q, catalogueSort, filtering ? FILTER_CANDIDATES : RESULTS, NO_FILTER);
      if (candidates.length > 0) {
        const games = await pickAndEnrich(candidates, filter, filtering);
        return NextResponse.json({ games, source: "bgg", sortApplied: true, hotAvailable: true } satisfies SearchResponse);
      }
    }

    // 3. A name the catalogue doesn't know (or no catalogue at all): BGG's own search / hotness
    const pool = q ? await liveNameSearch(q, filtering ? 50 : 12) : await liveHot(filtering ? 50 : RESULTS);
    const games = pool.filter((g) => matchesFilter(g, filter)).slice(0, RESULTS);
    return NextResponse.json({ games, source: "bgg", sortApplied: false, hotAvailable: true } satisfies SearchResponse);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    // BGG unavailable: fall back to the local catalogue (or the sample set) rather than an error.
    const body: SearchResponse = csv
      ? {
          games: searchCsv(q, catalogueSort, RESULTS, filter),
          source: "local",
          note: `BGG request failed (${reason}); showing the local catalogue.`,
          sortApplied: true,
          hotAvailable: hasToken,
        }
      : {
          games: searchMockGames(q).filter((g) => matchesFilter(g, filter)).slice(0, 12),
          source: "mock",
          note: hasToken
            ? `BGG request failed (${reason}); showing sample games.`
            : "No BGG_API_TOKEN configured; showing sample games.",
          sortApplied: true,
          hotAvailable: hasToken,
        };
    return NextResponse.json(body);
  }
}
