// Card notes: your typed words in a curly handwritten script on a paper card.
// You pick the paper colour, text size and alignment, and press rubber stamps
// (star, heart, smiley, moon, dots) wherever you like. Everything is drawn on
// a canvas and sent as a JPEG.

export const CARD_W = 640;
export const CARD_H = 480;
export const MAX_CARD_CHARS = 80;
export const MAX_STAMPS = 24;

export type CardColor = "pink" | "cream" | "blue" | "lilac" | "mint";
export type CardAlign = "left" | "center" | "right";
export type StampKind = "star" | "heart" | "smiley" | "moon" | "dots";

export type Stamp = { kind: StampKind; x: number; y: number; size: number; rot: number; seed: number };

export type CardOptions = {
  color: CardColor;
  align: CardAlign;
  /** Preferred text size in px; long notes shrink to fit. */
  size: number;
  stamps: Stamp[];
};

export const CARD_COLORS: { id: CardColor; label: string; swatch: string }[] = [
  { id: "pink", label: "Pink", swatch: "#f5a6d4" },
  { id: "cream", label: "Cream", swatch: "#f1ebe2" },
  { id: "blue", label: "Baby blue", swatch: "#bcdaf3" },
  { id: "lilac", label: "Lilac", swatch: "#d9c8f0" },
  { id: "mint", label: "Mint", swatch: "#c9ead6" },
];

export const STAMP_KINDS: { id: StampKind; label: string }[] = [
  { id: "star", label: "Star" },
  { id: "heart", label: "Heart" },
  { id: "smiley", label: "Smiley" },
  { id: "moon", label: "Moon" },
  { id: "dots", label: "Dots" },
];

export const TEXT_SIZE = { min: 32, max: 96, default: 72 };

export type CardFonts = { script: string; mono: string };

type Look = {
  paper: [string, string];
  ink: string;
  stamp: string;
  grain: number;
  folds: "h" | "cross";
  /** Hollow, outlined letters like a pen tracing them twice. */
  outline: boolean;
};

const LOOKS: Record<CardColor, Look> = {
  pink: { paper: ["#f7b2db", "#f19acb"], ink: "#38323c", stamp: "#66778f", grain: 18, folds: "h", outline: false },
  cream: { paper: ["#f3eee6", "#e8e1d6"], ink: "#3f6fc2", stamp: "#d06a8e", grain: 12, folds: "cross", outline: true },
  blue: { paper: ["#c8e2f6", "#acd0ef"], ink: "#2b3a63", stamp: "#e58fb5", grain: 14, folds: "h", outline: false },
  lilac: { paper: ["#e3d5f5", "#cfbbec"], ink: "#4a2f63", stamp: "#7a8fb8", grain: 14, folds: "h", outline: false },
  mint: { paper: ["#d4f0df", "#b9e3c9"], ink: "#2f4a3a", stamp: "#e38aa9", grain: 14, folds: "cross", outline: false },
};

/** A few stars so a fresh card already looks like the pink star card. */
export function defaultStamps(): Stamp[] {
  const spots: [number, number, number][] = [
    [62, 70, 26], [584, 56, 22], [600, 300, 20], [48, 330, 24], [130, 432, 18], [540, 430, 26], [330, 446, 16],
  ];
  return spots.map(([x, y, size], i) => ({ kind: "star", x, y, size, rot: i * 0.7, seed: i + 1 }));
}

export function makeStamp(kind: StampKind, x: number, y: number): Stamp {
  const base = kind === "dots" ? 22 : 24;
  return {
    kind,
    x: Math.round(x),
    y: Math.round(y),
    size: Math.round(base * (0.85 + Math.random() * 0.35)),
    rot: kind === "smiley" || kind === "dots" ? (Math.random() - 0.5) * 0.4 : (Math.random() - 0.5) * 0.9,
    seed: Math.floor(Math.random() * 1e6),
  };
}

function seeded(seed: number) {
  let h = seed | 0 || 1;
  return () => ((h = (h * 1103515245 + 12345) | 0) >>> 8) / 16777216;
}

// ---------------------------------------------------------------- paper

const paperCache = new Map<string, HTMLCanvasElement>();

/** Paper, grain and fold creases. Cached per colour + seed. */
function paper(color: CardColor, seed: number) {
  const key = `${color}:${seed}`;
  const hit = paperCache.get(key);
  if (hit) return hit;
  const look = LOOKS[color];
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d")!;
  const rand = seeded(seed);

  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, look.paper[0]);
  g.addColorStop(1, look.paper[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Paper grain: fine per-pixel noise plus a few darker fibres.
  const img = ctx.getImageData(0, 0, CARD_W, CARD_H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * look.grain;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = "rgba(90,70,80,0.08)";
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 90; i++) {
    const x = rand() * CARD_W;
    const y = rand() * CARD_H;
    const a = rand() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    ctx.stroke();
  }

  // Fold creases: a soft shadow line with a highlight beside it.
  const crease = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number) => {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(60,40,50,0.13)";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(x1 + nx, y1 + ny);
    ctx.lineTo(x2 + nx, y2 + ny);
    ctx.stroke();
  };
  const fy = CARD_H * 0.53;
  crease(0, fy, CARD_W, fy + 2, 0, 1.5);
  if (look.folds === "cross") {
    crease(CARD_W / 2, 0, CARD_W / 2 - 2, CARD_H, 1.5, 0);
    crease(0, CARD_H * 0.27, CARD_W, CARD_H * 0.27 - 1, 0, 1.5);
  }

  // A slightly darker, worn edge.
  const v = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, CARD_H * 0.45, CARD_W / 2, CARD_H / 2, CARD_H * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(60,30,50,0.12)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  paperCache.set(key, c);
  if (paperCache.size > 8) paperCache.delete(paperCache.keys().next().value!);
  return c;
}

// ---------------------------------------------------------------- stamps

/** Traces a stamp's shape (centred on 0,0, radius r) as one path. */
function stampPath(ctx: CanvasRenderingContext2D, kind: StampKind, r: number) {
  ctx.beginPath();
  if (kind === "star") {
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.42;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else if (kind === "heart") {
    ctx.moveTo(0, r * 0.95);
    ctx.bezierCurveTo(-r * 1.25, r * 0.1, -r * 0.95, -r * 0.95, 0, -r * 0.4);
    ctx.bezierCurveTo(r * 0.95, -r * 0.95, r * 1.25, r * 0.1, 0, r * 0.95);
    ctx.closePath();
  } else if (kind === "moon") {
    // A crescent: the outer circle minus an offset circle.
    ctx.arc(0, 0, r, Math.PI * 0.3, Math.PI * 1.7, false);
    ctx.arc(r * 0.45, -r * 0.18, r * 0.8, Math.PI * 1.42, Math.PI * 0.58, true);
    ctx.closePath();
  } else if (kind === "smiley") {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else {
    // Dots: a little cluster, like a polka-dot stamp.
    const dots: [number, number, number][] = [
      [0, 0, 0.3], [-0.62, -0.38, 0.22], [0.6, -0.42, 0.24], [-0.5, 0.55, 0.2], [0.58, 0.5, 0.22], [0.05, -0.85, 0.16], [0.02, 0.88, 0.15],
    ];
    for (const [dx, dy, dr] of dots) {
      ctx.moveTo(dx * r + dr * r, dy * r);
      ctx.arc(dx * r, dy * r, dr * r, 0, Math.PI * 2);
    }
  }
}

const stampCache = new Map<string, HTMLCanvasElement>();

/** A rubber-stamp impression: flat ink, uneven coverage, a few gaps. */
export function drawStamp(ctx: CanvasRenderingContext2D, s: Stamp, color: CardColor, alpha = 1) {
  const off = stampSprite(s, color);
  ctx.save();
  ctx.globalAlpha = 0.9 * alpha;
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);
  ctx.drawImage(off, -off.width / 2, -off.height / 2);
  ctx.restore();
}

function stampSprite(s: Stamp, color: CardColor) {
  const key = `${s.kind}:${s.size}:${s.seed}:${color}`;
  const hit = stampCache.get(key);
  if (hit) return hit;
  const ink = LOOKS[color].stamp;
  const pad = 6;
  const R = s.size;
  const W = Math.ceil(R * 2 + pad * 2);
  const off = document.createElement("canvas");
  off.width = W;
  off.height = W;
  const o = off.getContext("2d")!;
  o.translate(W / 2, W / 2);
  stampPath(o, s.kind, R);
  o.fillStyle = ink;
  o.fill("evenodd");
  if (s.kind === "smiley") {
    // Cut the face out of the inked circle.
    o.globalCompositeOperation = "destination-out";
    o.beginPath();
    o.arc(-R * 0.36, -R * 0.25, R * 0.13, 0, Math.PI * 2);
    o.arc(R * 0.36, -R * 0.25, R * 0.13, 0, Math.PI * 2);
    o.fill();
    o.lineWidth = R * 0.13;
    o.lineCap = "round";
    o.beginPath();
    o.arc(0, R * 0.05, R * 0.5, Math.PI * 0.18, Math.PI * 0.82);
    o.stroke();
  }
  // Uneven ink: speckled gaps and a lighter patch where the stamp didn't press.
  o.globalCompositeOperation = "destination-out";
  const rand = seeded(s.seed + 11);
  for (let i = 0; i < R * 5; i++) {
    o.fillStyle = `rgba(0,0,0,${0.25 + rand() * 0.6})`;
    o.fillRect((rand() - 0.5) * W, (rand() - 0.5) * W, 1 + rand() * 1.4, 1 + rand() * 1.4);
  }
  const patch = o.createRadialGradient(R * (rand() - 0.5), R * (rand() - 0.5), 0, 0, 0, R * 1.1);
  patch.addColorStop(0, "rgba(0,0,0,0.28)");
  patch.addColorStop(1, "rgba(0,0,0,0)");
  o.fillStyle = patch;
  o.fillRect(-W / 2, -W / 2, W, W);

  stampCache.set(key, off);
  if (stampCache.size > 80) stampCache.delete(stampCache.keys().next().value!);
  return off;
}

// ---------------------------------------------------------------- lettering

function wrap(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The chosen size, or the biggest smaller size where the words fit the box. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: string, want: number, boxW: number, boxH: number) {
  const words = text.split(/\s+/).filter(Boolean);
  for (let size = want; size >= 24; size -= 2) {
    ctx.font = `${size}px ${font}`;
    const lines = wrap(ctx, words, boxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const lineH = size * 1.12;
    if (widest <= boxW && lines.length * lineH <= boxH) return { size, lines, lineH };
  }
  ctx.font = `24px ${font}`;
  return { size: 24, lines: wrap(ctx, words, boxW), lineH: 24 * 1.12 };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Draws the whole card. `seed` keeps the paper and the hand-drawn wobble the
 * same while you edit; an empty text shows a faint placeholder. `ghost` is a
 * stamp shown faintly under the pointer before you press it.
 */
export function drawCardNote(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  opts: CardOptions,
  fonts: CardFonts,
  seed: number,
  ghost: Stamp | null = null,
  date = new Date(),
) {
  const look = LOOKS[opts.color];
  ctx.drawImage(paper(opts.color, seed), 0, 0);
  for (const s of opts.stamps) drawStamp(ctx, s, opts.color);

  const text = rawText.trim().replace(/\s+/g, " ").slice(0, MAX_CARD_CHARS);
  const rand = seeded(seed * 7 + 3);

  // The date, typed at the top.
  ctx.save();
  ctx.fillStyle = look.outline ? "#2d2a2a" : look.ink;
  ctx.globalAlpha = 0.85;
  ctx.textBaseline = "top";
  ctx.font = `17px ${fonts.mono}`;
  ctx.textAlign = opts.align === "right" ? "left" : opts.align === "left" ? "right" : "center";
  const dateX = opts.align === "right" ? 36 : opts.align === "left" ? CARD_W - 36 : CARD_W / 2;
  ctx.fillText(formatDate(date), dateX, 28);
  ctx.restore();

  const margin = 64;
  const boxW = CARD_W - margin * 2;
  const boxTop = 66;
  const boxH = CARD_H - boxTop - 48;
  const shown = text || "type your note…";
  const { size, lines, lineH } = fit(ctx, shown, fonts.script, opts.size, boxW, boxH);
  const blockH = lines.length * lineH;
  let y = boxTop + (boxH - blockH) / 2 + lineH * 0.78;

  ctx.save();
  ctx.font = `${size}px ${fonts.script}`;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  if (!text) ctx.globalAlpha = 0.3;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    const x = opts.align === "left" ? margin : opts.align === "right" ? CARD_W - margin - w : (CARD_W - w) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rand() - 0.5) * 0.045);
    if (look.outline && size >= 40) {
      // Trace the letters with ink, then fill them with paper: hollow lettering.
      ctx.strokeStyle = look.ink;
      ctx.lineWidth = Math.max(2, size * 0.05);
      ctx.strokeText(line, 0, 0);
      ctx.fillStyle = look.paper[0];
      ctx.fillText(line, 0, 0);
    } else {
      ctx.fillStyle = look.ink;
      ctx.fillText(line, 0, 0);
    }
    ctx.restore();
    y += lineH;
  }
  ctx.restore();

  if (ghost) drawStamp(ctx, ghost, opts.color, 0.45);
}
