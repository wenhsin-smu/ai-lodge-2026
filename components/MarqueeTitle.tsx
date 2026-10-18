"use client";

// "Study Booth" spelled in light bulbs on a dark marquee board. The script
// lettering is sampled onto a dot grid; bulbs switch on left to right like the
// words are being written, then a few twinkle now and then. With reduced
// motion every bulb is simply on.

import { useEffect, useRef } from "react";

const W = 1000;
const H = 300;
const TEXT = "Study Booth";
const STEP = 9; // grid spacing between bulbs
const BULB = 3.5; // bulb radius
const WRITE_MS = 2400;
const BULB_MS = 180; // each bulb's fade-in

type Bulb = { x: number; y: number; at: number; twinkle: number };

function scriptFont() {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-card").trim() || "cursive";
}

/** Samples the lettering onto a square grid of bulb positions. */
function layoutBulbs(font: string): Bulb[] {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  let size = 190;
  ctx.font = `${size}px ${font}`;
  while (ctx.measureText(TEXT).width > W - 60 && size > 60) {
    size -= 4;
    ctx.font = `${size}px ${font}`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(TEXT, W / 2, H / 2 + size * 0.05);
  // Thicken the pen line so strokes are two or three bulbs wide, like a real marquee.
  ctx.strokeStyle = "#000";
  ctx.lineWidth = size * 0.03;
  ctx.lineJoin = "round";
  ctx.strokeText(TEXT, W / 2, H / 2 + size * 0.05);
  const data = ctx.getImageData(0, 0, W, H).data;
  const bulbs: Bulb[] = [];
  let minX = W;
  let maxX = 0;
  for (let y = STEP / 2; y < H; y += STEP) {
    for (let x = STEP / 2; x < W; x += STEP) {
      // A bulb goes wherever most of its cell is ink.
      let ink = 0;
      for (const [dx, dy] of [[0, 0], [-2, -2], [2, -2], [-2, 2], [2, 2]]) {
        if (data[((Math.round(y + dy) * W + Math.round(x + dx)) << 2) + 3] > 110) ink++;
      }
      if (ink >= 3) {
        bulbs.push({ x, y, at: 0, twinkle: Math.random() });
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }
  // Light up left to right, with a little vertical sweep so letters "draw".
  for (const b of bulbs) b.at = ((b.x - minX) / Math.max(1, maxX - minX)) * WRITE_MS + (b.y / H) * 120;
  return bulbs;
}

/** One pre-rendered lit bulb: warm cream core, soft glow. */
function bulbSprite(scale: number) {
  const r = BULB * scale;
  const glow = r * 3.2;
  const s = document.createElement("canvas");
  s.width = s.height = Math.ceil(glow * 2);
  const g = s.getContext("2d")!;
  const c = glow;
  const halo = g.createRadialGradient(c, c, 0, c, c, glow);
  halo.addColorStop(0, "rgba(255, 214, 140, 0.55)");
  halo.addColorStop(0.35, "rgba(255, 190, 110, 0.18)");
  halo.addColorStop(1, "rgba(255, 170, 90, 0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, s.width, s.height);
  const core = g.createRadialGradient(c - r * 0.3, c - r * 0.35, 0, c, c, r);
  core.addColorStop(0, "#fffdf2");
  core.addColorStop(0.55, "#fbe7b0");
  core.addColorStop(1, "#e9c27a");
  g.fillStyle = core;
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.fill();
  return s;
}

export default function MarqueeTitle() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let live = true;

    void document.fonts.load(`120px ${scriptFont()}`).catch(() => {}).then(() => {
      if (!live) return;
      const bulbs = layoutBulbs(scriptFont());
      const sprite = bulbSprite(dpr);
      const half = sprite.width / dpr / 2;
      const start = performance.now();

      const draw = (now: number) => {
        const t = reduce ? Infinity : now - start;
        ctx.clearRect(0, 0, W, H);
        // Unlit bulbs: dark glass dots, so the lettering is visible before it lights.
        ctx.fillStyle = "rgba(255, 220, 170, 0.09)";
        for (const b of bulbs) {
          if (t - b.at >= BULB_MS) continue;
          ctx.beginPath();
          ctx.arc(b.x, b.y, BULB * 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const b of bulbs) {
          let on = Math.min(1, Math.max(0, (t - b.at) / BULB_MS));
          if (on <= 0) continue;
          // After the writing, a gentle shimmer: each bulb dips now and then.
          if (t > WRITE_MS + BULB_MS) {
            const phase = Math.sin(now / 900 + b.twinkle * 40);
            if (phase > 0.985) on *= 0.45;
          }
          ctx.globalAlpha = on;
          ctx.drawImage(sprite, b.x - half, b.y - half, half * 2, half * 2);
        }
        ctx.globalAlpha = 1;
        if (!reduce) frame = requestAnimationFrame(draw);
      };
      if (reduce) draw(0);
      else frame = requestAnimationFrame(draw);
    });

    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="marquee-board">
      <canvas ref={ref} aria-hidden="true" />
    </div>
  );
}
