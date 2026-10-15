// Turns typed text into embroidery: lays out the letters, splits each stroke
// into overlapping slanted stitches, and draws fabric, stitches and the needle.

import { GLYPHS, LETTER_GAP, SPACE_WIDTH } from "@/lib/stitchFont";

export const NOTE_W = 640;
export const NOTE_H = 480;
const MARGIN = 40;

// Thread colours, like a hand-embroidered sampler.
const THREADS = ["#2b3fa8", "#c2338f", "#13915a", "#e8402f", "#5b5b60", "#e07b12"];

type P = { x: number; y: number };
export type Stitch = { a: P; b: P; color: string; thick: number };

/** Small seeded random generator so the same note always stitches the same way. */
function seededRandom(seed: string) {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeNote(text: string) {
  return text.toUpperCase().replace(/[‘’`]/g, "'").replace(/&/g, "+").replace(/\s+/g, " ").trim();
}

export function unsupportedChars(text: string) {
  return [...new Set([...normalizeNote(text)].filter((c) => c !== " " && !GLYPHS[c]))];
}

function wordWidth(word: string) {
  const chars = [...word].filter((c) => GLYPHS[c]);
  if (chars.length === 0) return 0;
  return chars.reduce((w, c) => w + GLYPHS[c].width, 0) + LETTER_GAP * (chars.length - 1);
}

/** Wraps words into lines for a given cap height, or null if it doesn't fit. */
function layout(words: string[], unit: number) {
  const maxW = NOTE_W - MARGIN * 2;
  const lines: string[][] = [];
  let line: string[] = [];
  let lineW = 0;
  for (const word of words) {
    const w = wordWidth(word) * unit;
    if (w > maxW) return null;
    const next = line.length ? lineW + SPACE_WIDTH * unit + w : w;
    if (next > maxW && line.length) {
      lines.push(line);
      line = [word];
      lineW = w;
    } else {
      line.push(word);
      lineW = next;
    }
  }
  if (line.length) lines.push(line);
  const lineHeight = unit * 10 * 1.55;
  const blockH = lines.length * lineHeight - unit * 10 * 0.55;
  return blockH <= NOTE_H - MARGIN * 2 ? { lines, lineHeight, blockH } : null;
}

function pointAt(pts: P[], lengths: number[], d: number): P {
  for (let i = 1; i < pts.length; i++) {
    if (d <= lengths[i] || i === pts.length - 1) {
      const seg = lengths[i] - lengths[i - 1] || 1;
      const t = Math.min(1, Math.max(0, (d - lengths[i - 1]) / seg));
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
  }
  return pts[pts.length - 1];
}

/** Splits a stroke into stem stitches: short, slanted, each overlapping the last. */
function stitchStroke(pts: P[], unit: number, color: string, out: Stitch[]) {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = lengths[lengths.length - 1];
  const step = Math.max(4, unit * 1.05);
  const thick = Math.max(2.5, unit * 0.85);
  const tilt = 0.3;
  const count = Math.max(1, Math.ceil(total / step));
  for (let i = 0; i < count; i++) {
    const d0 = i * step;
    const d1 = Math.min(total, d0 + step * 1.7);
    const p0 = pointAt(pts, lengths, d0);
    const p1 = pointAt(pts, lengths, Math.max(d1, d0 + 0.01));
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const rot = (p: P) => ({
      x: mx + (p.x - mx) * cos - (p.y - my) * sin,
      y: my + (p.x - mx) * sin + (p.y - my) * cos,
    });
    out.push({ a: rot(p0), b: rot(p1), color, thick });
  }
}

/** Builds every stitch for the note, in sewing order. */
export function buildStitches(text: string): Stitch[] {
  const note = normalizeNote(text);
  const words = note.split(" ").filter((w) => wordWidth(w) > 0);
  if (words.length === 0) return [];
  const rand = seededRandom(note);

  let fit: NonNullable<ReturnType<typeof layout>> | null = null;
  let unit = 16;
  for (; unit >= 2.4; unit -= 0.4) {
    fit = layout(words, unit);
    if (fit) break;
  }
  if (!fit) return [];

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
        for (const stroke of glyph.strokes) stitchStroke(stroke.map(place), unit, color, stitches);
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

/** Off-white woven cotton. */
export function drawFabric(ctx: CanvasRenderingContext2D) {
  const rand = seededRandom("fabric");
  ctx.fillStyle = "#efede6";
  ctx.fillRect(0, 0, NOTE_W, NOTE_H);
  for (let y = 0; y < NOTE_H; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? "rgba(255,255,255,0.45)" : "rgba(90,80,60,0.05)";
    ctx.fillRect(0, y, NOTE_W, 1.5);
  }
  for (let x = 0; x < NOTE_W; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? "rgba(255,255,255,0.25)" : "rgba(90,80,60,0.04)";
    ctx.fillRect(x, 0, 1.2, NOTE_H);
  }
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(110,95,70,${rand() * 0.07})`;
    ctx.fillRect(rand() * NOTE_W, rand() * NOTE_H, 1 + rand() * 2, 1);
  }
}

export function drawStitch(ctx: CanvasRenderingContext2D, s: Stitch) {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.lineCap = "round";

  // Shadow where the thread sits on the fabric.
  ctx.strokeStyle = "rgba(60,45,30,0.28)";
  ctx.lineWidth = s.thick + 1;
  ctx.beginPath();
  ctx.moveTo(s.a.x + 0.8, s.a.y + 1.3);
  ctx.lineTo(s.b.x + 0.8, s.b.y + 1.3);
  ctx.stroke();

  // Thread body.
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.thick;
  ctx.beginPath();
  ctx.moveTo(s.a.x, s.a.y);
  ctx.lineTo(s.b.x, s.b.y);
  ctx.stroke();

  // Twisted strands: a light sheen on one side, a darker groove on the other.
  const inset = 0.15;
  const ax = s.a.x + dx * inset;
  const ay = s.a.y + dy * inset;
  const bx = s.b.x - dx * inset;
  const by = s.b.y - dy * inset;
  ctx.lineWidth = Math.max(0.8, s.thick * 0.22);
  ctx.strokeStyle = shade(s.color, 0.4);
  ctx.beginPath();
  ctx.moveTo(ax - nx * s.thick * 0.18, ay - ny * s.thick * 0.18);
  ctx.lineTo(bx - nx * s.thick * 0.18, by - ny * s.thick * 0.18);
  ctx.stroke();
  ctx.strokeStyle = shade(s.color, -0.35);
  ctx.beginPath();
  ctx.moveTo(ax + nx * s.thick * 0.25, ay + ny * s.thick * 0.25);
  ctx.lineTo(bx + nx * s.thick * 0.25, by + ny * s.thick * 0.25);
  ctx.stroke();
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
  ctx.lineWidth = 2;
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
