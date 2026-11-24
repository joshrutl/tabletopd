import type { Game } from "./types";

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  aacute: "á",
  ouml: "ö",
  uuml: "ü",
  auml: "ä",
  szlig: "ß",
  ccedil: "ç",
  ntilde: "ñ",
};

function decodeOnce(s: string): string {
  return s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,8}));/g, (match, dec, hex, name) => {
    if (dec || hex) {
      const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
      try {
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      } catch {
        return match;
      }
    }
    return NAMED[name] ?? match;
  });
}

/**
 * Decodes HTML entities in text from BGG ("Andromeda&#039;s Edge" -> "Andromeda's Edge").
 * Runs twice because BGG sometimes double-encodes ("&amp;#039;").
 */
export function decodeHtmlEntities(input: string): string {
  if (!input.includes("&")) return input;
  return decodeOnce(decodeOnce(input));
}

/** Returns the game with a decoded name; the same object when nothing needed decoding. */
export function cleanGame<T extends Pick<Game, "name">>(game: T): T {
  const name = decodeHtmlEntities(game.name);
  return name === game.name ? game : { ...game, name };
}
