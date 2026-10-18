// Shared path tools for note styles (Stitched, Bedazzled): seeded randomness,
// line layout for a single-line font, Chaikin smoothing and even resampling.

export type P = { x: number; y: number };
export type FontGlyph = { width: number; strokes: [number, number][][] };

/** Small seeded random generator so the same note always renders the same way. */
export function seededRandom(seed: string) {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

export type LayoutOptions = {
  glyphs: Record<string, FontGlyph>;
  letterGap: number;
  spaceWidth: number;
  /** Line pitch as a multiple of the 10-unit cap height. */
  lineFactor: number;
  width: number;
  height: number;
  margin: number;
};

export function wordWidth(word: string, o: LayoutOptions) {
  const chars = [...word].filter((c) => o.glyphs[c]);
  if (chars.length === 0) return 0;
  return chars.reduce((w, c) => w + o.glyphs[c].width, 0) + o.letterGap * (chars.length - 1);
}

/** Wraps words into lines for a given unit (cap height / 10), or null if it doesn't fit. */
export function layoutLines(words: string[], unit: number, o: LayoutOptions) {
  const maxW = o.width - o.margin * 2;
  const lines: string[][] = [];
  let line: string[] = [];
  let lineW = 0;
  for (const word of words) {
    const w = wordWidth(word, o) * unit;
    if (w > maxW) return null;
    const next = line.length ? lineW + o.spaceWidth * unit + w : w;
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
  const lineHeight = unit * 10 * o.lineFactor;
  const blockH = lines.length * lineHeight - unit * 10 * (o.lineFactor - 1);
  return blockH <= o.height - o.margin * 2 ? { lines, lineHeight, blockH } : null;
}

/** Largest unit (from maxUnit down) at which the words fit. */
export function fitLayout(words: string[], maxUnit: number, o: LayoutOptions) {
  for (let unit = maxUnit; unit >= 2.4; unit -= 0.4) {
    const fit = layoutLines(words, unit, o);
    if (fit) return { unit, ...fit };
  }
  return null;
}

/** Chaikin corner cutting: rounds the path gently while keeping its endpoints. */
export function chaikin(pts: P[], iterations = 2, ratio = 0.07): P[] {
  let out = pts;
  for (let it = 0; it < iterations && out.length > 2; it++) {
    const next: P[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i];
      const b = out[i + 1];
      next.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
      next.push({ x: a.x + (b.x - a.x) * (1 - ratio), y: a.y + (b.y - a.y) * (1 - ratio) });
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** Points at an even spacing along a polyline (equal spacing on curves and corners too). */
export function resample(pts: P[], spacing: number): P[] {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = lengths[lengths.length - 1];
  if (total < 0.5) return [pts[0], { x: pts[0].x + 0.5, y: pts[0].y }];
  const n = Math.max(1, Math.round(total / spacing));
  const out: P[] = [];
  let seg = 1;
  for (let k = 0; k <= n; k++) {
    const d = (k / n) * total;
    while (seg < pts.length - 1 && lengths[seg] < d) seg++;
    const span = lengths[seg] - lengths[seg - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - lengths[seg - 1]) / span));
    out.push({ x: pts[seg - 1].x + (pts[seg].x - pts[seg - 1].x) * t, y: pts[seg - 1].y + (pts[seg].y - pts[seg - 1].y) * t });
  }
  return out;
}
