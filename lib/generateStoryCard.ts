import type { Game } from "./types";
import type { ShelfStats } from "./stats";
import { validImageUrl } from "./images";

/** A game on the card plus the user's own rating of it (0 = unrated). */
export interface StoryGame {
  game: Game;
  rating: number;
}

export interface StoryCardOptions {
  /** e.g. "@josh's Top 4 Board Games" or a list title */
  title: string;
  /** e.g. a list's description */
  subtitle?: string;
  /** Up to four games for the 2x2 grid; null/missing slots are drawn as empty placeholders. */
  games: (StoryGame | null)[];
  /** Show #1-#4 rank pills (ranked lists) */
  ranked: boolean;
  /** Summary pills at the bottom; null hides them */
  stats: ShelfStats | null;
  /** Footer line, e.g. "tabletopd.vercel.app/u/josh" */
  footerUrl: string;
  /** Games in the list beyond the four shown */
  moreCount?: number;
}

/* ------------------------------ layout & theme ----------------------------- */

const W = 1080;
const H = 1920;
const PAD = 72;
const BG_TOP = "#14181C";
const BG_BOTTOM = "#1E252D";
const LINE = "#2C3440";
const EMERALD = "#00E054";
const AMBER = "#FF8000";
const MUTED = "#99AABB";
const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

const CELL_W = 420;
const CELL_H = 560;
const GAP = 32;
const GRID_X = (W - (CELL_W * 2 + GAP)) / 2;
const GRID_Y = 450;

/* --------------------------------- helpers -------------------------------- */

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wraps text to `maxWidth`, truncating with an ellipsis after `maxLines`. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  // Greedy line breaking first...
  const all: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(trial).width <= maxWidth) {
      current = trial;
    } else {
      all.push(current);
      current = word;
    }
  }
  if (current) all.push(current);

  // ...then cut to maxLines, ending the last kept line with an ellipsis.
  if (all.length <= maxLines) return all;
  const kept = all.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // Not available in every browser; the wordmark just renders unspaced there.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function playerPill(g: Game): string {
  const players = g.maxPlayers ? (g.minPlayers === g.maxPlayers ? `${g.minPlayers}p` : `${g.minPlayers}–${g.maxPlayers}p`) : "";
  const time = g.playingTime ? `${g.playingTime}m` : "";
  return [players, time].filter(Boolean).join(" • ");
}

/* --------------------------------- images --------------------------------- */

/** Loads an image for canvas use. Resolves null on any failure (including CORS), never throws. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // keeps the canvas exportable; failure falls back to the typographic cover
    img.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/** The game's own cover URL, or one from our image route (which returns null until BGG_API_TOKEN is set). */
async function coverUrl(game: Game): Promise<string | null> {
  const direct = validImageUrl(game.image) ?? validImageUrl(game.thumbnail);
  if (direct) return direct;
  if (!/^\d+$/.test(game.id)) return null;
  try {
    const res = await fetch(`/api/bgg/image?id=${game.id}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return validImageUrl(((await res.json()) as { image_url?: string | null }).image_url);
  } catch {
    return null;
  }
}

/* --------------------------------- drawing -------------------------------- */

function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft accent glows
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(120, 140, 760, "rgba(0,224,84,0.16)");
  glow(W - 100, H - 180, 820, "rgba(255,128,0,0.13)");

  // Accent lines
  const line = (y: number, color: string) => {
    const g = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(PAD, y, W - PAD * 2, 3);
  };
  line(424, EMERALD);
  line(1630, AMBER);
}

function drawHeader(ctx: CanvasRenderingContext2D, title: string, subtitle?: string) {
  // TABLETOPD wordmark badge
  ctx.font = `800 34px ${FONT}`;
  setLetterSpacing(ctx, 5);
  const label = "TABLETOPD";
  const badgeW = ctx.measureText(label).width + 56;
  ctx.fillStyle = EMERALD;
  roundedRect(ctx, PAD, 96, badgeW, 66, 18);
  ctx.fill();
  ctx.fillStyle = BG_TOP;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(label, PAD + 28, 130);
  setLetterSpacing(ctx, 0);

  // Title (up to 2 lines)
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 62px ${FONT}`;
  let y = 250;
  for (const l of wrapLines(ctx, title, W - PAD * 2, 2)) {
    ctx.fillText(l, PAD, y);
    y += 74;
  }

  if (subtitle) {
    ctx.fillStyle = MUTED;
    ctx.font = `500 32px ${FONT}`;
    for (const l of wrapLines(ctx, subtitle, W - PAD * 2, y > 330 ? 1 : 2)) {
      ctx.fillText(l, PAD, y - 4);
      y += 42;
    }
  }
}

function drawTypographicCover(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number, w: number, h: number) {
  const hue = game.hue ?? (Number(game.id) % 360 || 200);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, `hsl(${hue} 45% 30%)`);
  g.addColorStop(1, `hsl(${(hue + 40) % 360} 50% 12%)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // Decorative rings
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 3;
  for (const r of [150, 230, 310]) {
    ctx.beginPath();
    ctx.arc(x + w * 0.9, y + h * 0.88, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Title, year, pill
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 46px ${FONT}`;
  let ty = y + 118; // leaves room for the rank pill
  for (const l of wrapLines(ctx, game.name, w - 64, 5)) {
    ctx.fillText(l, x + 32, ty);
    ty += 54;
  }
  if (game.yearPublished) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(String(game.yearPublished), x + 32, ty + 12);
  }
  const pill = playerPill(game);
  if (pill) {
    ctx.font = `700 26px ${FONT}`;
    const pw = ctx.measureText(pill).width + 36;
    const py = y + h - 150;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundedRect(ctx, x + 28, py, pw, 46, 23);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.textBaseline = "middle";
    ctx.fillText(pill, x + 46, py + 24);
    ctx.textBaseline = "alphabetic";
  }
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  // object-fit: cover
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  color: string,
  font = `800 32px ${FONT}`,
) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 40;
  ctx.fillStyle = fill;
  roundedRect(ctx, x, y, w, 56, 28);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 20, y + 29);
  ctx.textBaseline = "alphabetic";
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  slot: StoryGame | null,
  image: HTMLImageElement | null,
  index: number,
  ranked: boolean,
) {
  const col = index % 2;
  const row = Math.floor(index / 2);
  const x = GRID_X + col * (CELL_W + GAP);
  const y = GRID_Y + row * (CELL_H + GAP);

  if (!slot) {
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 3;
    roundedRect(ctx, x, y, CELL_W, CELL_H, 28);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = LINE;
    ctx.font = `800 54px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ranked ? `#${index + 1}` : "+", x + CELL_W / 2, y + CELL_H / 2);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    return;
  }

  // Shadow behind the card
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = BG_TOP;
  roundedRect(ctx, x, y, CELL_W, CELL_H, 28);
  ctx.fill();
  ctx.restore();

  // Cover (clipped to the rounded card)
  ctx.save();
  roundedRect(ctx, x, y, CELL_W, CELL_H, 28);
  ctx.clip();
  if (image) drawImageCover(ctx, image, x, y, CELL_W, CELL_H);
  else drawTypographicCover(ctx, slot.game, x, y, CELL_W, CELL_H);
  // legibility gradient for the badges
  const fade = ctx.createLinearGradient(0, y + CELL_H * 0.6, 0, y + CELL_H);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = fade;
  ctx.fillRect(x, y + CELL_H * 0.6, CELL_W, CELL_H * 0.4);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  roundedRect(ctx, x, y, CELL_W, CELL_H, 28);
  ctx.stroke();

  if (ranked) drawPill(ctx, `#${index + 1}`, x + 20, y + 20, AMBER, BG_TOP);
  if (slot.rating > 0) {
    drawPill(ctx, `${slot.rating.toFixed(1)} ★`, x + 20, y + CELL_H - 76, "rgba(0,0,0,0.72)", EMERALD);
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, stats: ShelfStats | null, footerUrl: string, moreCount?: number) {
  const gridBottom = GRID_Y + CELL_H * 2 + GAP;
  if (moreCount && moreCount > 0) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 28px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`+${moreCount} more ${moreCount === 1 ? "game" : "games"} in this list`, GRID_X + CELL_W * 2 + GAP, gridBottom + 44);
    ctx.textAlign = "left";
  }

  if (stats) {
    const items: [string, string][] = [
      [`${stats.owned} Owned`, EMERALD],
      [`${stats.played} Played`, "#FFFFFF"],
      [`${stats.avg ? stats.avg.toFixed(1) : "—"} ★ Avg`, AMBER],
    ];
    ctx.font = `800 30px ${FONT}`;
    const gap = 16;
    const widths = items.map(([t]) => ctx.measureText(t).width + 52);
    let x = (W - (widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1))) / 2;
    const y = 1672;
    items.forEach(([text, color], i) => {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundedRect(ctx, x, y, widths[i], 68, 34);
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      roundedRect(ctx, x, y, widths[i], 68, 34);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + widths[i] / 2, y + 35);
      x += widths[i] + gap;
    });
    ctx.textBaseline = "alphabetic";
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(footerUrl, W / 2, 1800);
  ctx.fillStyle = MUTED;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText("Game data powered by BoardGameGeek", W / 2, 1850);
  ctx.textAlign = "left";
}

/* ---------------------------------- public --------------------------------- */

/**
 * Renders the 1080x1920 (9:16) story card entirely in the browser and returns
 * it as a PNG. Cover images that can't be loaded (no URL, network, or CORS)
 * fall back to a styled typographic cover, so this always succeeds.
 */
export async function generateStoryCard(options: StoryCardOptions): Promise<Blob> {
  const slots = [0, 1, 2, 3].map((i) => options.games[i] ?? null);

  // Resolve and load covers in parallel.
  const images = await Promise.all(
    slots.map(async (s) => {
      if (!s) return null;
      const url = await coverUrl(s.game);
      return url ? loadImage(url) : null;
    }),
  );

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");

  drawBackground(ctx);
  drawHeader(ctx, options.title, options.subtitle);
  slots.forEach((s, i) => drawCell(ctx, s, images[i], i, options.ranked));
  drawFooter(ctx, options.stats, options.footerUrl, options.moreCount);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image."))), "image/png"),
  );
}
