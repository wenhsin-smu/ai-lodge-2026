// Bedazzled notes: text spelled out in rhinestones along a single-line script font,
// using the same path pipeline as stitched notes (layout -> smooth -> resample).

import { chaikin, fitLayout, resample, seededRandom, wordWidth, type LayoutOptions, type P } from "@/lib/notePaths";
import { SCRIPT_GLYPHS, SCRIPT_SPACE_WIDTH } from "@/lib/scriptFont";

export const GEM_W = 640;
export const GEM_H = 480;

export type GemColor = "crystal" | "pink" | "ab" | "pearl" | "mixed";
export type CardColor = "pink" | "blue" | "lilac" | "white";
type GemKind = Exclude<GemColor, "mixed">;

export const GEM_COLORS: { id: GemColor; label: string }[] = [
  { id: "crystal", label: "Crystal" },
  { id: "pink", label: "Pink" },
  { id: "ab", label: "AB iridescent" },
  { id: "pearl", label: "Pearl" },
  { id: "mixed", label: "Mixed" },
];

export const CARD_COLORS: { id: CardColor; label: string }[] = [
  { id: "pink", label: "Pink card" },
  { id: "blue", label: "Baby blue" },
  { id: "lilac", label: "Lilac" },
  { id: "white", label: "White" },
];

const CARDS: Record<CardColor, [string, string]> = {
  pink: ["#fbd3df", "#f3b6c8"],
  blue: ["#dcecfb", "#bcd9f2"],
  lilac: ["#ece1f8", "#d6c4ee"],
  white: ["#fffdfb", "#f1eeea"],
};

export type Gem = { x: number; y: number; r: number; rot: number; kind: GemKind; variant: number };

const LAYOUT: LayoutOptions = {
  glyphs: SCRIPT_GLYPHS,
  letterGap: 0, // script letters join up
  spaceWidth: SCRIPT_SPACE_WIDTH,
  lineFactor: 2.0, // room for loops and descenders
  width: GEM_W,
  height: GEM_H,
  margin: 44,
};

export function normalizeGemText(text: string) {
  return text.replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

export function unsupportedGemChars(text: string) {
  return [...new Set([...normalizeGemText(text)].filter((c) => c !== " " && !SCRIPT_GLYPHS[c]))];
}

/** Lays the text out in script and places gems along every stroke, never overlapping. */
export function buildGems(text: string, color: GemColor): Gem[] {
  const note = normalizeGemText(text);
  const words = note.split(" ").filter((w) => wordWidth(w, LAYOUT) > 0);
  if (words.length === 0) return [];
  const fit = fitLayout(words, 15, LAYOUT);
  if (!fit) return [];
  const { unit } = fit;
  const rand = seededRandom(`${note}|${color}`);
  const D = Math.max(6, unit * 0.95); // gem diameter
  const spacing = D * 1.05; // gems almost touch

  // Spatial hash so overlap checks stay fast.
  const cell = D;
  const grid = new Map<string, Gem[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const overlaps = (x: number, y: number, r: number) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const g of grid.get(`${cx + i},${cy + j}`) ?? []) if (Math.hypot(g.x - x, g.y - y) < (g.r + r) * 0.92) return true;
    return false;
  };

  const kinds: GemKind[] = ["crystal", "pink", "ab", "pearl"];
  const gems: Gem[] = [];
  // Vertically centre the block on its cap height, leaving descenders room below.
  let y = (GEM_H - fit.blockH) / 2 - unit * 1.2;
  for (const line of fit.lines) {
    const lineW = line.reduce((w, word) => w + wordWidth(word, LAYOUT) * unit, 0) + SCRIPT_SPACE_WIDTH * unit * (line.length - 1);
    let x = (GEM_W - lineW) / 2;
    for (const word of line) {
      for (const c of word) {
        const glyph = SCRIPT_GLYPHS[c];
        if (!glyph) continue;
        for (const stroke of glyph.strokes) {
          const pts: P[] = stroke.map(([gx, gy]) => ({ x: x + gx * unit, y: y + gy * unit }));
          const path = pts.length > 1 ? resample(chaikin(pts, 3, 0.22), spacing) : pts;
          for (const p of path) {
            const small = rand() < 0.08;
            const r = (D / 2) * (1 + (rand() - 0.5) * 0.1) * (small ? 0.8 : 1);
            const rot = rand() * Math.PI * 2;
            const kind = color === "mixed" ? kinds[Math.floor(rand() * kinds.length)] : color;
            const variant = Math.floor(rot / (Math.PI / 2)); // 4 facet orientations
            if (overlaps(p.x, p.y, r)) continue;
            const gem = { x: p.x, y: p.y, r, rot, kind, variant };
            gems.push(gem);
            const k = key(p.x, p.y);
            grid.set(k, [...(grid.get(k) ?? []), gem]);
          }
        }
        x += glyph.width * unit;
      }
      x += SCRIPT_SPACE_WIDTH * unit;
    }
    y += fit.lineHeight;
  }
  return gems;
}

// ---------------------------------------------------------------- card background

export function drawCard(ctx: CanvasRenderingContext2D, color: CardColor) {
  const [hi, lo] = CARDS[color];
  const rand = seededRandom(`card-${color}`);
  const g = ctx.createLinearGradient(0, 0, GEM_W * 0.4, GEM_H);
  g.addColorStop(0, hi);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GEM_W, GEM_H);

  // Smooth paper: very fine speckle and fibres.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${rand() * 0.18})` : `rgba(120,80,100,${rand() * 0.05})`;
    ctx.fillRect(rand() * GEM_W, rand() * GEM_H, 1 + rand() * 1.5, 1);
  }

  // Faint sheen across the card.
  const sheen = ctx.createLinearGradient(0, 0, GEM_W, GEM_H);
  sheen.addColorStop(0, "rgba(255,255,255,0.22)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, GEM_W, GEM_H);

  // Soft diagonal light streaks along the right edge.
  ctx.save();
  ctx.translate(GEM_W * 0.86, 0);
  ctx.rotate(0.38);
  for (const [off, w, a] of [
    [0, 26, 0.22],
    [44, 12, 0.16],
    [70, 40, 0.1],
  ] as const) {
    const s = ctx.createLinearGradient(off, 0, off + w, 0);
    s.addColorStop(0, "rgba(255,255,255,0)");
    s.addColorStop(0.5, `rgba(255,255,255,${a})`);
    s.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = s;
    ctx.fillRect(off, -60, w, GEM_H * 1.4);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- gem sprites

const SCALE = 3; // supersampling
const sprites = new Map<string, HTMLCanvasElement>();

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h},${s}%,${Math.max(0, Math.min(100, l))}%,${a})`;
}

/** A sprite including glue halo and shadow; the gem centre is the sprite centre. */
export function gemSprite(kind: GemKind, radius: number, variant: number) {
  const rKey = Math.round(radius * 2) / 2;
  const key = `${kind}|${rKey}|${variant}`;
  const cached = sprites.get(key);
  if (cached) return cached;
  const r = rKey;
  const pad = r * 0.9;
  const size = Math.ceil((r + pad) * 2);
  const c = document.createElement("canvas");
  c.width = c.height = size * SCALE;
  const g = c.getContext("2d")!;
  g.scale(SCALE, SCALE);
  g.translate(size / 2, size / 2);
  const rand = seededRandom(key);

  // Glue halo: a faint translucent puddle around the base.
  const glue = g.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.38);
  glue.addColorStop(0, "rgba(255,255,255,0.32)");
  glue.addColorStop(0.7, "rgba(255,255,255,0.12)");
  glue.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glue;
  g.beginPath();
  g.arc(0, 0, r * 1.4, 0, Math.PI * 2);
  g.fill();

  // Soft drop shadow beneath.
  g.save();
  g.filter = `blur(${Math.max(0.8, r * 0.18)}px)`;
  g.fillStyle = "rgba(90,40,60,0.32)";
  g.beginPath();
  g.ellipse(r * 0.14, r * 0.26, r * 0.98, r * 0.92, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  if (kind === "pearl") drawPearl(g, r, variant);
  else drawFaceted(g, r, kind, variant, rand);

  sprites.set(key, c);
  return c;
}

function drawPearl(g: CanvasRenderingContext2D, r: number, variant: number) {
  const body = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.45, "#f7f1f4");
  body.addColorStop(0.85, "#ddd2df");
  body.addColorStop(1, "#c7b9cc");
  g.fillStyle = body;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  // Iridescent rim tint.
  const tint = g.createLinearGradient(-r, r, r, -r);
  tint.addColorStop(0, `hsla(${330 + variant * 15},70%,85%,0.35)`);
  tint.addColorStop(0.5, "rgba(255,255,255,0)");
  tint.addColorStop(1, `hsla(${200 + variant * 10},70%,85%,0.3)`);
  g.fillStyle = tint;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  // Glossy highlight and a soft lower glint.
  g.fillStyle = "rgba(255,255,255,0.95)";
  g.beginPath();
  g.ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.17, -0.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.beginPath();
  g.arc(r * 0.38, r * 0.42, r * 0.1, 0, Math.PI * 2);
  g.fill();
}

function drawFaceted(g: CanvasRenderingContext2D, r: number, kind: Exclude<GemKind, "pearl">, variant: number, rand: () => number) {
  // Thin silver rim.
  const rim = g.createLinearGradient(-r, -r, r, r);
  rim.addColorStop(0, "#ffffff");
  rim.addColorStop(0.5, "#b9bec8");
  rim.addColorStop(1, "#8e94a0");
  g.fillStyle = rim;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();

  const inner = r * 0.9;
  const table = r * 0.48;
  const light = (-3 * Math.PI) / 4; // light from the upper left
  const facetColor = (i: number, angle: number, l: number) => {
    if (kind === "crystal") return hsl(215, 18, l);
    if (kind === "pink") return hsl(338, 78, l * 0.92 + 4);
    // AB iridescent: each facet a different hue, shifted per variant.
    const hue = (variant * 47 + i * 45 + (angle * 180) / Math.PI) % 360;
    return hsl(hue, 70, l * 0.9 + 6);
  };

  // 8 facets between the girdle and the octagonal table, each lit differently.
  // Each variant turns the facet pattern a little, so neighbouring gems look hand-placed;
  // the highlights stay put because the light doesn't move.
  const turn = variant * (Math.PI / 16) + rand() * 0.2;
  const outer = (k: number) => ({ x: Math.cos((k * Math.PI) / 4 + turn) * inner, y: Math.sin((k * Math.PI) / 4 + turn) * inner });
  const tab = (k: number) => ({
    x: Math.cos((k * Math.PI) / 4 + Math.PI / 8 + turn) * table,
    y: Math.sin((k * Math.PI) / 4 + Math.PI / 8 + turn) * table,
  });
  for (let k = 0; k < 8; k++) {
    const mid = (k * Math.PI) / 4 + Math.PI / 8 + turn;
    const facing = Math.cos(mid - light); // 1 = faces the light
    const l = 62 + facing * 26 + (rand() - 0.5) * 10;
    const a = outer(k);
    const b = outer(k + 1);
    const t1 = tab(k - 1 < 0 ? 7 : k - 1);
    const t2 = tab(k);
    // Each facet = two triangles: girdle edge to table vertex, and table edge to girdle.
    g.fillStyle = facetColor(k, mid, l);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(t2.x, t2.y);
    g.closePath();
    g.fill();
    g.fillStyle = facetColor(k, mid, l - 8 + (rand() - 0.5) * 6);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(t2.x, t2.y);
    g.lineTo(t1.x, t1.y);
    g.closePath();
    g.fill();
  }
  // Facet edges.
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = Math.max(0.3, r * 0.04);
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = outer(k);
    const t2 = tab(k);
    g.moveTo(a.x, a.y);
    g.lineTo(t2.x, t2.y);
  }
  g.stroke();

  // Table: the flat top, bright with a soft gradient.
  const tg = g.createLinearGradient(-table, -table, table, table);
  tg.addColorStop(0, kind === "pink" ? "#ffe3ee" : kind === "ab" ? hsl((variant * 47 + 180) % 360, 60, 92) : "#ffffff");
  tg.addColorStop(1, kind === "pink" ? "#f5a6c3" : kind === "ab" ? hsl((variant * 47 + 260) % 360, 60, 78) : "#cdd5e2");
  g.fillStyle = tg;
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const t = tab(k);
    if (k === 0) g.moveTo(t.x, t.y);
    else g.lineTo(t.x, t.y);
  }
  g.closePath();
  g.fill();

  // Refraction flecks in clear and AB stones.
  if (kind !== "pink") {
    for (const col of ["rgba(255,150,200,0.75)", "rgba(130,190,255,0.75)", "rgba(255,225,120,0.75)"]) {
      const ang = rand() * Math.PI * 2;
      const dist = r * (0.3 + rand() * 0.45);
      g.fillStyle = col;
      g.beginPath();
      g.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, Math.max(0.35, r * 0.07), 0, Math.PI * 2);
      g.fill();
    }
  }

  // Sharp white highlight upper-left, small glint lower-right.
  g.fillStyle = "rgba(255,255,255,0.98)";
  g.beginPath();
  g.ellipse(-r * 0.4, -r * 0.42, r * 0.2, r * 0.11, -0.75, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.beginPath();
  g.arc(r * 0.42, r * 0.38, Math.max(0.4, r * 0.07), 0, Math.PI * 2);
  g.fill();
}

/** Stamps one gem (scale lets the pop animation bounce it). */
export function drawGem(ctx: CanvasRenderingContext2D, gem: Gem, scale = 1) {
  const sprite = gemSprite(gem.kind, gem.r, gem.variant);
  const size = sprite.width / SCALE;
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.scale(scale, scale);
  ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** A small 4-point star sparkle; t goes 0 -> 1 over its life. */
export function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number) {
  const a = Math.sin(Math.PI * t);
  const s = size * (0.4 + 0.6 * a);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.6);
  ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = size * 0.6;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? s : s * 0.18;
    ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
