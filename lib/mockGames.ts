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

/**
 * Box-art covers for the curated games, from each game's Wikipedia article (looked up and
 * checked to serve an image). Games without a usable Wikipedia image are omitted and render the
 * styled title card until a BGG token supplies real art. Covers belong to their publishers.
 */
const COVERS: Record<string, string> = {
  "13": "https://upload.wikimedia.org/wikipedia/en/a/a3/Catan-2015-boxart.jpg", // Catan
  "50": "https://upload.wikimedia.org/wikipedia/en/9/93/Lostcities250px.jpg", // Lost Cities
  "822": "https://upload.wikimedia.org/wikipedia/en/5/5e/Carcassonne-game.jpg", // Carcassonne
  "2655": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Hive_%28Carbon_Edition%29_Game.jpg/500px-Hive_%28Carbon_Edition%29_Game.jpg", // Hive
  "9209": "https://upload.wikimedia.org/wikipedia/en/9/92/Ticket_to_Ride_Board_Game_Box_EN.jpg", // Ticket to Ride
  "30549": "https://upload.wikimedia.org/wikipedia/en/3/36/Pandemic_game.jpg", // Pandemic
  "39856": "https://upload.wikimedia.org/wikipedia/en/7/7b/Dixitgame.jpg", // Dixit
  "54043": "https://upload.wikimedia.org/wikipedia/en/6/69/Japiur_card_game_box_cover.jpg", // Jaipur
  "65244": "https://upload.wikimedia.org/wikipedia/en/b/b0/Forbidden_Island_game_cover.jpg", // Forbidden Island
  "68448": "https://upload.wikimedia.org/wikipedia/en/0/0b/7_Wonders_-_New_Edition_boxart.png", // 7 Wonders
  "98778": "https://upload.wikimedia.org/wikipedia/en/b/b1/Hanabi_cover.jpg", // Hanabi
  "129622": "https://upload.wikimedia.org/wikipedia/en/e/e1/Love_Letter_box_cover.jpg", // Love Letter
  "133473": "https://upload.wikimedia.org/wikipedia/en/9/98/Sushi_Go%21_box.jpg", // Sushi Go!
  "148228": "https://upload.wikimedia.org/wikipedia/en/2/2e/BoardGameSplendorLogoFairUse.jpg", // Splendor
  "153938": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Camel_Up_board_game.jpg/500px-Camel_Up_board_game.jpg", // Camel Up
  "173346": "https://upload.wikimedia.org/wikipedia/en/6/6d/7_Wonders_Duel_cover.png", // 7 Wonders Duel
  "178900": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Codenames_board_game.jpg/500px-Codenames_board_game.jpg", // Codenames
  "194655": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Santorini_game_render.jpg/500px-Santorini_game_render.jpg", // Santorini
  "199561": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/A_nearly_complete_window_in_Sagrada.jpg/500px-A_nearly_complete_window_in_Sagrada.jpg", // Sagrada
  "204583": "https://upload.wikimedia.org/wikipedia/en/a/a3/Kingdomino_Box_Cover.png", // Kingdomino
  "230802": "https://upload.wikimedia.org/wikipedia/en/2/23/Picture_of_Azul_game_box.jpg", // Azul
  "244521": "https://upload.wikimedia.org/wikipedia/en/e/e3/The_Quacks_of_Quedlinburg_box_cover.jpg", // The Quacks of Quedlinburg
  "254640": "https://upload.wikimedia.org/wikipedia/en/6/61/Just_One_box.png", // Just One
  "266192": "https://upload.wikimedia.org/wikipedia/en/c/c3/3d-wingspan-768x752.png", // Wingspan
  "295947": "https://upload.wikimedia.org/wikipedia/en/7/79/Cascadia_box_cover.JPG", // Cascadia
};

export const MOCK_GAMES: Game[] = META.map(
  ([id, name, year, min, max, time, rating]): Game => ({
    id,
    name,
    yearPublished: year,
    thumbnail: COVERS[id] ?? null,
    image: COVERS[id] ?? null,
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
