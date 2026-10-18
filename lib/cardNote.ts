// Card notes: your typed words in a curly handwritten script on a paper card.
// Two cards: pink paper with scattered stars, or a cream folded postcard with
// hollow blue lettering. Everything is drawn on a canvas and sent as a JPEG.

export const CARD_W = 640;
export const CARD_H = 480;
export const MAX_CARD_CHARS = 80;

export type CardStyle = "pink" | "postcard";

export const CARD_STYLES: { id: CardStyle; label: string }[] = [
  { id: "pink", label: "Pink stars" },
  { id: "postcard", label: "Postcard" },
];

export type CardFonts = { script: string; mono: string };

type Look = {
  paper: [string, string];
  ink: string;
  grain: number;
  folds: "h" | "cross";
  /** Hollow, outlined letters like a pen tracing them twice. */
  outline: boolean;
};

const LOOKS: Record<CardStyle, Look> = {
  pink: { paper: ["#f7b2db", "#f19acb"], ink: "#38323c", grain: 18, folds: "h", outline: false },
  postcard: { paper: ["#f3eee6", "#e8e1d6"], ink: "#3f6fc2", grain: 12, folds: "cross", outline: true },
};

function seeded(seed: number) {
  let h = seed | 0 || 1;
  return () => ((h = (h * 1103515245 + 12345) | 0) >>> 8) / 16777216;
}

// ---------------------------------------------------------------- paper

const paperCache = new Map<string, HTMLCanvasElement>();

/** Paper, grain, fold creases and (on pink) stars. Cached per style + seed. */
function paper(style: CardStyle, seed: number) {
  const key = `${style}:${seed}`;
  const hit = paperCache.get(key);
  if (hit) return hit;
  const look = LOOKS[style];
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

  if (style === "pink") drawStars(ctx, rand);

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

/** Slate-blue paper stars scattered around the border, clear of the middle. */
function drawStars(ctx: CanvasRenderingContext2D, rand: () => number) {
  const placed: { x: number; y: number; r: number }[] = [];
  let tries = 0;
  while (placed.length < 12 && tries++ < 400) {
    const r = 11 + rand() * 15;
    const x = 14 + rand() * (CARD_W - 28);
    const y = 14 + rand() * (CARD_H - 28);
    // Keep the writing area (the middle of the card) clear.
    if (x > CARD_W * 0.12 && x < CARD_W * 0.88 && y > CARD_H * 0.16 && y < CARD_H * 0.84) continue;
    // ...and the typed date at the top.
    if (y < 80 && x > CARD_W * 0.25 && x < CARD_W * 0.75) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 18)) continue;
    placed.push({ x, y, r });
  }
  for (const s of placed) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(rand() * Math.PI);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? s.r : s.r * 0.42;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.shadowColor = "rgba(40,30,40,0.25)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    const tone = 0.85 + rand() * 0.25;
    ctx.fillStyle = `rgb(${Math.round(110 * tone)},${Math.round(122 * tone)},${Math.round(140 * tone)})`;
    ctx.fill();
    ctx.shadowColor = "transparent";
    // Faint stripes, like stars cut from printed paper.
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    for (let k = -s.r; k < s.r; k += 4) {
      ctx.beginPath();
      ctx.moveTo(k, -s.r);
      ctx.lineTo(k + s.r, s.r);
      ctx.stroke();
    }
    ctx.restore();
  }
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

/** Biggest size where the words fit the box (the script font is wide and tall). */
function fit(ctx: CanvasRenderingContext2D, text: string, font: string, boxW: number, boxH: number) {
  const words = text.split(/\s+/).filter(Boolean);
  for (let size = 86; size >= 26; size -= 2) {
    ctx.font = `${size}px ${font}`;
    const lines = wrap(ctx, words, boxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const lineH = size * 1.12;
    if (widest <= boxW && lines.length * lineH <= boxH) return { size, lines, lineH };
  }
  ctx.font = `26px ${font}`;
  return { size: 26, lines: wrap(ctx, words, boxW), lineH: 26 * 1.12 };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Draws the whole card. `seed` keeps the stars and the hand-drawn wobble the
 * same while you type; an empty text shows a faint placeholder.
 */
export function drawCardNote(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  style: CardStyle,
  fonts: CardFonts,
  seed: number,
  date = new Date(),
) {
  const look = LOOKS[style];
  ctx.drawImage(paper(style, seed), 0, 0);
  const text = rawText.trim().replace(/\s+/g, " ").slice(0, MAX_CARD_CHARS);
  const rand = seeded(seed * 7 + 3);

  // Small typewritten details.
  ctx.save();
  ctx.fillStyle = look.ink;
  ctx.globalAlpha = 0.85;
  ctx.textBaseline = "top";
  if (style === "pink") {
    ctx.font = `17px ${fonts.mono}`;
    ctx.textAlign = "center";
    ctx.fillText(formatDate(date), CARD_W / 2, 30);
  } else {
    ctx.fillStyle = "#2d2a2a";
    ctx.font = `15px ${fonts.mono}`;
    ctx.textAlign = "center";
    const [day, rest] = [date.toLocaleDateString("en-GB", { weekday: "long" }), date.toLocaleDateString("en-GB", { day: "numeric", month: "long" })];
    ctx.fillText(day, CARD_W - 88, 26);
    ctx.fillText(rest, CARD_W - 88, 44);
    ctx.font = `11px ${fonts.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("A LITTLE NOTE FOR YOU", 30, CARD_H - 26);
  }
  ctx.restore();

  const boxW = style === "pink" ? CARD_W - 170 : CARD_W - 110;
  const boxTop = style === "pink" ? 70 : 80;
  const boxH = CARD_H - boxTop - (style === "pink" ? 56 : 60);
  const shown = text || "type your note…";
  const { size, lines, lineH } = fit(ctx, shown, fonts.script, boxW, boxH);
  const blockH = lines.length * lineH;
  let y = boxTop + (boxH - blockH) / 2 + lineH * 0.78;

  ctx.save();
  ctx.font = `${size}px ${fonts.script}`;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  if (!text) ctx.globalAlpha = 0.3;
  lines.forEach((line, i) => {
    const w = ctx.measureText(line).width;
    // Postcard lines step in and out like handwriting; pink is centred.
    const x =
      style === "pink"
        ? (CARD_W - w) / 2
        : Math.min(CARD_W - 50 - w, 55 + (lines.length === 1 ? (boxW - w) / 2 : [0, 0.45, 0.2, 0.6][i % 4] * (boxW - w)));
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
  });
  ctx.restore();
}
