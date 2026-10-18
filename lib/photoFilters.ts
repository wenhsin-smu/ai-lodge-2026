// Live photo filters, applied to every preview frame and to the captured photo,
// so what you see is exactly what gets sent.

export type FilterId = "none" | "digicam" | "film" | "bw";

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "digicam", label: "Digicam" },
  { id: "film", label: "Film" },
  { id: "bw", label: "B&W" },
];

type Work = { small: HTMLCanvasElement; copy: HTMLCanvasElement; grain: HTMLCanvasElement };
const works = new WeakMap<HTMLCanvasElement, Work>();

function workFor(canvas: HTMLCanvasElement): Work {
  let w = works.get(canvas);
  if (!w) {
    const make = (cw: number, ch: number) => {
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      return c;
    };
    // Reusable grain tile (fine monochrome noise).
    const grain = make(128, 128);
    const g = grain.getContext("2d")!;
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 120;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    w = { small: make(canvas.width / 2, canvas.height / 2), copy: make(canvas.width, canvas.height), grain };
    works.set(canvas, w);
  }
  return w;
}

/** Applies the filter in place to the canvas (already holding the camera frame). */
export function applyFilter(canvas: HTMLCanvasElement, id: FilterId, date = new Date()) {
  if (id === "none") return;
  const ctx = canvas.getContext("2d")!;
  const { width: W, height: H } = canvas;
  const work = workFor(canvas);

  if (id === "digicam") {
    digicam(ctx, canvas, work);
    vignette(ctx, W, H, 0.32);
    drawDateStamp(ctx, W, H, date);
    return;
  }

  // Film and B&W: CSS-style colour filters, then grain and vignette.
  const copy = work.copy.getContext("2d")!;
  copy.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.filter = id === "film" ? "sepia(0.28) saturate(0.85) contrast(0.88) brightness(1.06)" : "grayscale(1) contrast(1.18) brightness(1.03)";
  ctx.drawImage(work.copy, 0, 0);
  ctx.restore();
  if (id === "film") {
    // Faded blacks and a warm cast.
    ctx.save();
    ctx.globalCompositeOperation = "lighten";
    ctx.fillStyle = "rgba(48,36,30,1)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,190,120,0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  grain(ctx, W, H, work.grain, id === "bw" ? 0.16 : 0.12);
  vignette(ctx, W, H, id === "bw" ? 0.38 : 0.28);
}

/** Early-2000s compact camera: soft low-res, hot highlights, cool-to-warm cast, edge fringing, grain. */
function digicam(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, work: Work) {
  const { width: W, height: H } = canvas;
  const sw = work.small.width;
  const sh = work.small.height;
  const s = work.small.getContext("2d", { willReadFrequently: true })!;
  s.imageSmoothingEnabled = true;
  s.drawImage(canvas, 0, 0, sw, sh);
  const src = s.getImageData(0, 0, sw, sh);
  const out = s.createImageData(sw, sh);
  const d = src.data;
  const o = out.data;
  const cx = sw / 2;
  const cy = sh / 2;
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < sh; y++) {
    const t = y / sh; // 0 top (cool) -> 1 bottom (warm)
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      // Chromatic aberration grows toward the edges (up to ~2px at full size).
      const r = Math.hypot(x - cx, y - cy) / maxR;
      const shift = Math.round(r * r * 1.6);
      const ir = (y * sw + Math.min(sw - 1, x + shift)) * 4;
      const ib = (y * sw + Math.max(0, x - shift)) * 4;
      let R = d[ir];
      let G = d[i + 1];
      let B = d[ib + 2];
      // Slight overexposure with blown-out highlights.
      R = R * 1.04 + (R > 195 ? (R - 195) * 0.35 : 0);
      G = G * 1.04 + (G > 195 ? (G - 195) * 0.35 : 0);
      B = B * 1.04 + (B > 195 ? (B - 195) * 0.35 : 0);
      // Cool sky up top, warm skin tones below.
      R += -6 + 16 * t;
      G += 2 * t;
      B += 10 - 18 * t;
      const n = (Math.random() - 0.5) * 18;
      o[i] = R + n;
      o[i + 1] = G + n;
      o[i + 2] = B + n;
      o[i + 3] = 255;
    }
  }
  s.putImageData(out, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
  ctx.drawImage(work.small, 0, 0, W, H);
  ctx.restore();
}

function grain(ctx: CanvasRenderingContext2D, W: number, H: number, tile: HTMLCanvasElement, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  const ox = Math.floor(Math.random() * 128);
  const oy = Math.floor(Math.random() * 128);
  for (let y = -oy; y < H; y += 128) for (let x = -ox; x < W; x += 128) ctx.drawImage(tile, x, y);
  ctx.restore();
}

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, strength: number) {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.9);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- seven-segment date stamp

//   a
// f   b
//   g
// e   c
//   d
const DIGIT_SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

function segment(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, t: number, vertical: boolean) {
  // A thin hexagon, like a real LED/LCD segment.
  const h = t / 2;
  ctx.beginPath();
  if (vertical) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + h, y + h);
    ctx.lineTo(x + h, y + len - h);
    ctx.lineTo(x, y + len);
    ctx.lineTo(x - h, y + len - h);
    ctx.lineTo(x - h, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + h, y - h);
    ctx.lineTo(x + len - h, y - h);
    ctx.lineTo(x + len, y);
    ctx.lineTo(x + len - h, y + h);
    ctx.lineTo(x + h, y + h);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDigit(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number, t: number) {
  const on = DIGIT_SEGMENTS[ch] ?? "";
  const half = h / 2;
  const gap = t * 0.35;
  const has = (s: string) => on.includes(s);
  if (has("a")) segment(ctx, x + gap, y, w - 2 * gap, t, false);
  if (has("g")) segment(ctx, x + gap, y + half, w - 2 * gap, t, false);
  if (has("d")) segment(ctx, x + gap, y + h, w - 2 * gap, t, false);
  if (has("f")) segment(ctx, x, y + gap, half - 2 * gap, t, true);
  if (has("b")) segment(ctx, x + w, y + gap, half - 2 * gap, t, true);
  if (has("e")) segment(ctx, x, y + half + gap, half - 2 * gap, t, true);
  if (has("c")) segment(ctx, x + w, y + half + gap, half - 2 * gap, t, true);
}

/** Orange seven-segment date stamp ('YY MM DD) in the bottom-right corner, drawn as shapes. */
export function drawDateStamp(ctx: CanvasRenderingContext2D, W: number, H: number, date: Date) {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const groups = [yy, mm, dd];
  const dh = Math.round(H * 0.055); // digit height
  const dw = dh * 0.52;
  const t = Math.max(2, dh * 0.16);
  const dSpace = dw + t * 1.6;
  const gSpace = dw * 0.9;
  const total = t * 2 + groups.length * 2 * dSpace + (groups.length - 1) * gSpace;
  let x = W - total - W * 0.04;
  const y = H - dh - H * 0.05;

  ctx.save();
  ctx.fillStyle = "#ff8a1e";
  ctx.shadowColor = "rgba(255,120,20,0.9)";
  ctx.shadowBlur = dh * 0.35;
  // Apostrophe before the year.
  ctx.fillRect(x, y, t * 0.8, t * 1.8);
  x += t * 2;
  groups.forEach((g, gi) => {
    for (const ch of g) {
      drawDigit(ctx, ch, x, y, dw, dh, t);
      x += dSpace;
    }
    if (gi < groups.length - 1) x += gSpace;
  });
  ctx.restore();
}
