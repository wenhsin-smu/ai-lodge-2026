"use client";

// "Study Booth" spelled in glossy black dots, marquee style, straight on the
// page. The script lettering is sampled onto a dot grid; dots fill in left to
// right like the words are being written, then a few flicker now and then.
// With reduced motion every dot is simply shown.

import { useEffect, useRef } from "react";

const W = 1000;
const H = 300;
const TEXT = "Study Booth";
const STEP = 9; // grid spacing between bulbs
const BULB = 3; // bulb radius
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
  ctx.lineWidth = size * 0.018;
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

/** One pre-rendered bulb: a glossy black bead with a tiny highlight and soft shadow. */
function bulbSprite(scale: number) {
  const r = BULB * scale;
  const pad = r * 1.6;
  const s = document.createElement("canvas");
  s.width = s.height = Math.ceil(pad * 2);
  const g = s.getContext("2d")!;
  const c = pad;
  const shadow = g.createRadialGradient(c, c + r * 0.35, 0, c, c + r * 0.35, r * 1.5);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.22)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  g.fillStyle = shadow;
  g.fillRect(0, 0, s.width, s.height);
  const core = g.createRadialGradient(c - r * 0.35, c - r * 0.4, 0, c, c, r);
  core.addColorStop(0, "#6b6b70");
  core.addColorStop(0.45, "#2a2a2e");
  core.addColorStop(1, "#0d0d10");
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
        // Unlit bulbs: faint grey dots, so the lettering is visible before it fills in.
        ctx.fillStyle = "rgba(40, 40, 50, 0.08)";
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
