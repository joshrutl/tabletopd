import type { Game } from "./types";

/**
 * Curated metadata for popular, approachable games, keyed by BGG id
 * (ids were checked against data/boardgames_ranks.csv).
 *
 * Player counts and playtimes are the publisher-style figures as I recall
 * them, not pulled live. No box art is bundled; cards render a generated
 * gradient poster until a BGG_API_TOKEN supplies real images.
 */
type Meta = [id: string, name: string, year: number, min: number, max: number, time: number, rating: number];

const META: Meta[] = [
  ["266192", "Wingspan", 2019, 1, 5, 70, 8.1],
  ["230802", "Azul", 2017, 2, 4, 45, 7.8],
  ["295947", "Cascadia", 2021, 1, 4, 45, 8.1],
  ["414317", "Harmonies", 2024, 1, 4, 30, 7.9],
  ["68448", "7 Wonders", 2010, 2, 7, 30, 7.7],
  ["173346", "7 Wonders Duel", 2015, 2, 2, 30, 8.1],
  ["9209", "Ticket to Ride", 2004, 2, 5, 60, 7.4],
  ["148228", "Splendor", 2014, 2, 4, 30, 7.4],
  ["822", "Carcassonne", 2000, 2, 5, 45, 7.4],
  ["367220", "Sea Salt & Paper", 2022, 2, 4, 30, 7.6],
  ["133473", "Sushi Go!", 2013, 2, 5, 15, 7.0],
  ["192291", "Sushi Go Party!", 2016, 2, 8, 20, 7.6],
  ["163412", "Patchwork", 2014, 2, 2, 30, 7.6],
  ["54043", "Jaipur", 2009, 2, 2, 30, 7.5],
  ["13", "Catan", 1995, 3, 4, 120, 7.1],
  ["244521", "The Quacks of Quedlinburg", 2018, 2, 4, 45, 7.8],
  ["92415", "Skull", 2011, 3, 6, 30, 7.3],
  ["30549", "Pandemic", 2008, 2, 4, 45, 7.5],
  ["178900", "Codenames", 2015, 2, 8, 15, 7.6],
  ["204583", "Kingdomino", 2016, 2, 4, 15, 7.3],
  ["129622", "Love Letter", 2012, 2, 4, 20, 7.2],
  ["254640", "Just One", 2018, 3, 7, 20, 7.7],
  ["2655", "Hive", 2001, 2, 2, 20, 7.3],
  ["194655", "Santorini", 2016, 2, 4, 20, 7.4],
  ["50", "Lost Cities", 1999, 2, 2, 30, 7.6],
  ["432", "Take 5", 1994, 2, 10, 45, 7.0],
  ["39856", "Dixit", 2008, 3, 6, 30, 7.2],
  ["264055", "Draftosaurus", 2019, 2, 5, 15, 7.0],
  ["283155", "Calico", 2020, 1, 4, 45, 7.5],
  ["153938", "Camel Up", 2014, 2, 8, 30, 7.0],
  ["70323", "King of Tokyo", 2011, 2, 6, 30, 7.2],
  ["284083", "The Crew: The Quest for Planet Nine", 2019, 2, 5, 20, 8.1],
  ["65244", "Forbidden Island", 2010, 2, 4, 30, 6.9],
  ["199561", "Sagrada", 2017, 1, 4, 45, 7.5],
  ["98778", "Hanabi", 2010, 2, 5, 25, 7.0],
  ["131260", "Qwixx", 2012, 2, 5, 15, 7.0],
  ["204135", "Skyjo", 2015, 2, 8, 30, 6.9],
  ["291453", "SCOUT", 2019, 2, 5, 20, 7.8],
];

export const MOCK_GAMES: Game[] = META.map(
  ([id, name, year, min, max, time, rating]): Game => ({
    id,
    name,
    yearPublished: year,
    thumbnail: null,
    image: null,
    minPlayers: min,
    maxPlayers: max,
    playingTime: time,
    rating,
  }),
);

/** Lookup used to enrich CSV rows with real player counts and playtimes. */
export const MOCK_BY_ID: ReadonlyMap<string, Game> = new Map(MOCK_GAMES.map((g) => [g.id, g]));

/** Case-insensitive name search over the curated set; empty query returns all. */
export function searchMockGames(query: string): Game[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_GAMES;
  return MOCK_GAMES.filter((g) => g.name.toLowerCase().includes(q));
}
