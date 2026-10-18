// Turns typed text into embroidery: lays out the letters, splits each stroke
// into overlapping slanted stitches, and draws fabric, stitches and the needle.

import { chaikin, fitLayout, resample, seededRandom, wordWidth as fontWordWidth, type LayoutOptions } from "@/lib/notePaths";
import { GLYPHS, LETTER_GAP, SPACE_WIDTH } from "@/lib/stitchFont";

export const NOTE_W = 640;
export const NOTE_H = 480;
const MARGIN = 40;

// Thread colours, like a hand-embroidered sampler.
const THREADS = ["#2b3fa8", "#c2338f", "#13915a", "#e8402f", "#5b5b60", "#e07b12"];

type P = { x: number; y: number };

const STITCH_LAYOUT: LayoutOptions = {
  glyphs: GLYPHS,
  letterGap: LETTER_GAP,
  spaceWidth: SPACE_WIDTH,
  lineFactor: 1.55,
  width: NOTE_W,
  height: NOTE_H,
  margin: MARGIN,
};
/** One backstitch: from a to b (where the thread goes in and out of the fabric). */
export type Stitch = { a: P; b: P; color: string; shade: number; thick: number };
export function normalizeNote(text: string) {
  return text.toUpperCase().replace(/[‘’`]/g, "'").replace(/&/g, "+").replace(/\s+/g, " ").trim();
}

export function unsupportedChars(text: string) {
  return [...new Set([...normalizeNote(text)].filter((c) => c !== " " && !GLYPHS[c]))];
}

/** Backstitches along a smoothed, evenly resampled centre-line, with a little hand-made variation. */
function stitchStroke(pts: P[], unit: number, color: string, rand: () => number, out: Stitch[]) {
  const stitchLen = Math.min(9, Math.max(6, unit * 0.58));
  const gap = Math.max(0.9, stitchLen * 0.13);
  const thick = Math.min(4.4, Math.max(2.4, unit * 0.29));
  const path = resample(chaikin(pts), stitchLen + gap);
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i];
    const p1 = path[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Leave a tiny gap at the end; wobble length, angle and position by a pixel or two.
    const l = Math.max(2, len - gap + (rand() - 0.5) * 1.6);
    const ang = (rand() - 0.5) * 0.08;
    const vx = ux * Math.cos(ang) - uy * Math.sin(ang);
    const vy = ux * Math.sin(ang) + uy * Math.cos(ang);
    const off = (rand() - 0.5) * 0.9;
    const ax = p0.x + gap * 0.5 * ux - uy * off;
    const ay = p0.y + gap * 0.5 * uy + ux * off;
    out.push({ a: { x: ax, y: ay }, b: { x: ax + vx * l, y: ay + vy * l }, color, shade: Math.floor(rand() * SHADES.length), thick });
  }
}

/** Builds every stitch for the note, in sewing order. */
export function buildStitches(text: string): Stitch[] {
  const note = normalizeNote(text);
  const wordWidth = (w: string) => fontWordWidth(w, STITCH_LAYOUT);
  const words = note.split(" ").filter((w) => wordWidth(w) > 0);
  if (words.length === 0) return [];
  const rand = seededRandom(note);

  const fit = fitLayout(words, 16, STITCH_LAYOUT);
  if (!fit) return [];
  const unit = fit.unit;

  const stitches: Stitch[] = [];
  let lastColor = "";
  let y = (NOTE_H - fit.blockH) / 2;
  for (const line of fit.lines) {
    const lineW = line.reduce((w, word) => w + wordWidth(word) * unit, 0) + SPACE_WIDTH * unit * (line.length - 1);
    let x = (NOTE_W - lineW) / 2;
    for (const word of line) {
      for (const c of word) {
        const glyph = GLYPHS[c];
        if (!glyph) continue;
        let color = lastColor;
        while (color === lastColor) color = THREADS[Math.floor(rand() * THREADS.length)];
        lastColor = color;
        // Hand-made wobble: each letter slightly rotated and shifted.
        const angle = (rand() - 0.5) * 0.12;
        const dx = (rand() - 0.5) * unit * 0.6;
        const dy = (rand() - 0.5) * unit * 0.8;
        const cx = x + (glyph.width * unit) / 2;
        const cy = y + unit * 5;
        const place = ([gx, gy]: [number, number]): P => {
          const px = x + gx * unit - cx;
          const py = y + gy * unit - cy;
          return {
            x: cx + dx + px * Math.cos(angle) - py * Math.sin(angle),
            y: cy + dy + px * Math.sin(angle) + py * Math.cos(angle),
          };
        };
        for (const stroke of glyph.strokes) stitchStroke(stroke.map(place), unit, color, rand, stitches);
        x += (glyph.width + LETTER_GAP) * unit;
      }
      x += (SPACE_WIDTH - LETTER_GAP) * unit;
    }
    y += fit.lineHeight;
  }
  return stitches;
}

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/** Linen / aida cloth: fine weave with thread bundles and holes, soft light falloff. */
export function drawFabric(ctx: CanvasRenderingContext2D) {
  const rand = seededRandom("fabric");
  ctx.fillStyle = "#f1ece1";
  ctx.fillRect(0, 0, NOTE_W, NOTE_H);

  // One aida cell: a slightly raised thread bundle with holes at the corners.
  const tile = document.createElement("canvas");
  tile.width = tile.height = 6;
  const t = tile.getContext("2d")!;
  t.fillStyle = "#ede7da";
  t.fillRect(0, 0, 6, 6);
  t.fillStyle = "rgba(255,255,255,0.55)";
  t.fillRect(1, 1, 4, 2);
  t.fillStyle = "rgba(255,255,255,0.3)";
  t.fillRect(1, 3, 4, 1.5);
  t.fillStyle = "rgba(120,100,70,0.12)";
  t.fillRect(0, 0, 6, 0.7);
  t.fillRect(0, 0, 0.7, 6);
  t.fillStyle = "rgba(90,70,45,0.28)";
  t.fillRect(0, 0, 1, 1);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = ctx.createPattern(tile, "repeat")!;
  ctx.fillRect(0, 0, NOTE_W, NOTE_H);
  ctx.restore();

  // Irregular slubs, like real linen.
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${rand() * 0.25})` : `rgba(120,100,70,${rand() * 0.06})`;
    const horizontal = rand() > 0.5;
    const len = 4 + rand() * 18;
    ctx.fillRect(rand() * NOTE_W, rand() * NOTE_H, horizontal ? len : 1, horizontal ? 1 : len);
  }

  // Soft light from the top left, gently falling off toward the edges.
  const light = ctx.createRadialGradient(NOTE_W * 0.35, NOTE_H * 0.25, 40, NOTE_W * 0.5, NOTE_H * 0.5, NOTE_W * 0.75);
  light.addColorStop(0, "rgba(255,255,250,0.28)");
  light.addColorStop(0.6, "rgba(255,255,250,0)");
  light.addColorStop(1, "rgba(80,60,35,0.16)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, NOTE_W, NOTE_H);
}

// Small per-stitch colour variation: each thread colour has a few close shades.
const SHADES = [-0.06, -0.02, 0.02, 0.06];
const SPRITE_LEN = 10; // sprite drawn at this length, then stretched slightly per stitch
const SPRITE_SCALE = 4; // supersampling for crisp edges
const sprites = new Map<string, HTMLCanvasElement>();
let shadowSprite: HTMLCanvasElement | null = null;

/** Pre-rendered thread segment: rounded floss with a side highlight, darker ends and faint twist. */
function stitchSprite(color: string, shadeIdx: number, thick: number) {
  const key = `${color}|${shadeIdx}|${thick.toFixed(1)}`;
  const cached = sprites.get(key);
  if (cached) return cached;
  const h = thick + 2;
  const c = document.createElement("canvas");
  c.width = SPRITE_LEN * SPRITE_SCALE;
  c.height = Math.ceil(h * SPRITE_SCALE);
  const g = c.getContext("2d")!;
  g.scale(SPRITE_SCALE, SPRITE_SCALE);
  const base = shade(color, SHADES[shadeIdx]);
  const y0 = (h - thick) / 2;

  g.beginPath();
  g.roundRect(0.4, y0, SPRITE_LEN - 0.8, thick, thick / 2);
  g.clip();
  // Across the thread: light along one side, darker along the other.
  const across = g.createLinearGradient(0, y0, 0, y0 + thick);
  across.addColorStop(0, shade(color, SHADES[shadeIdx] + 0.42));
  across.addColorStop(0.35, base);
  across.addColorStop(1, shade(color, SHADES[shadeIdx] - 0.32));
  g.fillStyle = across;
  g.fillRect(0, 0, SPRITE_LEN, h);
  // Along the thread: darker where it dives into the fabric.
  const along = g.createLinearGradient(0, 0, SPRITE_LEN, 0);
  along.addColorStop(0, "rgba(30,20,10,0.35)");
  along.addColorStop(0.22, "rgba(30,20,10,0)");
  along.addColorStop(0.78, "rgba(30,20,10,0)");
  along.addColorStop(1, "rgba(30,20,10,0.35)");
  g.fillStyle = along;
  g.fillRect(0, 0, SPRITE_LEN, h);
  // Faint diagonal twist of the strands.
  g.strokeStyle = "rgba(0,0,0,0.16)";
  g.lineWidth = 0.35;
  for (let x = -thick; x < SPRITE_LEN + thick; x += 1.7) {
    g.beginPath();
    g.moveTo(x, y0 + thick);
    g.lineTo(x + thick * 0.8, y0);
    g.stroke();
  }
  g.strokeStyle = "rgba(255,255,255,0.18)";
  for (let x = -thick + 0.6; x < SPRITE_LEN + thick; x += 1.7) {
    g.beginPath();
    g.moveTo(x, y0 + thick * 0.55);
    g.lineTo(x + thick * 0.45, y0);
    g.stroke();
  }
  sprites.set(key, c);
  return c;
}

function getShadowSprite() {
  if (shadowSprite) return shadowSprite;
  const c = document.createElement("canvas");
  c.width = (SPRITE_LEN + 4) * SPRITE_SCALE;
  c.height = 8 * SPRITE_SCALE;
  const g = c.getContext("2d")!;
  g.scale(SPRITE_SCALE, SPRITE_SCALE);
  g.filter = "blur(0.6px)";
  g.fillStyle = "rgba(60,40,20,0.32)";
  g.beginPath();
  g.roundRect(2, 2.6, SPRITE_LEN, 2.8, 1.4);
  g.fill();
  shadowSprite = c;
  return c;
}

export function drawStitch(ctx: CanvasRenderingContext2D, s: Stitch) {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);
  const ux = dx / len;
  const uy = dy / len;

  // Needle holes just beyond each end, where the thread goes through the cloth.
  ctx.fillStyle = "rgba(70,50,30,0.38)";
  for (const [hx, hy] of [
    [s.a.x - ux * 0.6, s.a.y - uy * 0.6],
    [s.b.x + ux * 0.6, s.b.y + uy * 0.6],
  ]) {
    ctx.beginPath();
    ctx.arc(hx, hy, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  const mx = (s.a.x + s.b.x) / 2;
  const my = (s.a.y + s.b.y) / 2;
  // Tiny soft shadow, offset down-right in page space.
  const sh = getShadowSprite();
  ctx.save();
  ctx.translate(mx + 0.5, my + 0.8);
  ctx.rotate(angle);
  ctx.drawImage(sh, -(len + 4) / 2, -4 * (s.thick / 2.8), len + 4, 8 * (s.thick / 2.8));
  ctx.restore();

  const sprite = stitchSprite(s.color, s.shade, s.thick);
  const h = s.thick + 2;
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(angle);
  ctx.drawImage(sprite, -len / 2, -h / 2, len, h);
  ctx.restore();
}

/**
 * Draws the needle with its tip at `tip`, lifted `lift` px out of the fabric,
 * trailing thread in `color`.
 */
export function drawNeedle(ctx: CanvasRenderingContext2D, tip: P, lift: number, color: string) {
  const dir = { x: Math.cos(-0.8), y: Math.sin(-0.8) }; // points up and to the right
  const length = 115;
  const t = { x: tip.x + dir.x * lift, y: tip.y + dir.y * lift };
  const end = { x: t.x + dir.x * length, y: t.y + dir.y * length };
  const eye = { x: end.x - dir.x * 12, y: end.y - dir.y * 12 };

  // Thread hanging from the eye.
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(eye.x, eye.y);
  ctx.quadraticCurveTo(eye.x + 40, eye.y + 10, eye.x + 30, eye.y + 70);
  ctx.stroke();

  const shaft = (ox: number, oy: number, style: string, width: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width * 0.5;
    ctx.beginPath();
    ctx.moveTo(t.x + ox, t.y + oy);
    ctx.lineTo(t.x + dir.x * 16 + ox, t.y + dir.y * 16 + oy);
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(t.x + dir.x * 14 + ox, t.y + dir.y * 14 + oy);
    ctx.lineTo(end.x + ox, end.y + oy);
    ctx.stroke();
  };
  shaft(2 + lift * 0.4, 3 + lift * 0.4, "rgba(0,0,0,0.12)", 4.5); // shadow drifts as it lifts
  shaft(0, 0, "#7f868f", 4.5);
  shaft(-1, -0.8, "#f2f4f7", 1.4);

  // Eye of the needle.
  ctx.save();
  ctx.translate(eye.x, eye.y);
  ctx.rotate(-0.8);
  ctx.fillStyle = "#efede6";
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
