// Turns raw hand landmarks into a steady "pen" for writing on the fog.
// Pure logic (no DOM) so it can be unit-tested with synthetic landmarks.
//
//  - Pen down/up = pinch (thumb tip near index tip), measured relative to hand
//    size, with hysteresis so it doesn't flicker mid-letter.
//  - Position = pinch point, mirrored for the selfie view, with the central
//    region of the camera mapped to the whole canvas.
//  - One Euro filter: smooth when moving slowly, responsive when moving fast.
//  - Brief tracking loss keeps the stroke alive; longer loss lifts the pen.

export type Landmark = { x: number; y: number; z?: number };
export type Pt = { x: number; y: number };

export const PEN = {
  /** Pinch ratio below this puts the pen down... */
  downRatio: 0.32,
  /** ...and it only lifts again above this (hysteresis). */
  upRatio: 0.48,
  /** Fraction of the camera frame (centred) mapped to the full canvas. */
  activeRegion: 0.7,
  /** Keep the stroke through tracking gaps shorter than this. */
  lossGraceMs: 150,
  /** Ignore jitter smaller than this many canvas pixels while drawing. */
  minMovePx: 2.5,
  /** One Euro filter tuning (canvas pixels, seconds). */
  minCutoff: 1.2,
  beta: 0.02,
  dCutoff: 1.0,
};

// ---------------------------------------------------------------- One Euro filter

class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  get last() {
    return this.y;
  }
  reset() {
    this.y = null;
  }
}

const alphaFor = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/** One Euro filter (Casiez et al. 2012) for one coordinate. */
export class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private lastT: number | null = null;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  constructor(minCutoff = PEN.minCutoff, beta = PEN.beta, dCutoff = PEN.dCutoff) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }
  filter(value: number, tMs: number) {
    const prev = this.x.last;
    const dt = this.lastT === null ? 1 / 60 : Math.max(1e-3, (tMs - this.lastT) / 1000);
    this.lastT = tMs;
    const dValue = prev === null ? 0 : (value - prev) / dt;
    const edx = this.dx.filter(dValue, alphaFor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFor(cutoff, dt));
  }
  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastT = null;
  }
}

// ---------------------------------------------------------------- geometry

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

/** Thumb-tip to index-tip distance divided by hand size (wrist to middle knuckle). */
export function pinchRatio(lm: Landmark[]) {
  const handSize = dist(lm[0], lm[9]) || 1e-6;
  return dist(lm[4], lm[8]) / handSize;
}

/** Raw camera coords (0..1, un-mirrored) -> canvas pixels, mirrored, central region stretched. */
export function mapToCanvas(p: Landmark, w: number, h: number, region = PEN.activeRegion): Pt {
  const margin = (1 - region) / 2;
  const u = (1 - p.x - margin) / region; // mirror: moving your hand right moves right on screen
  const v = (p.y - margin) / region;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return { x: clamp(u) * w, y: clamp(v) * h };
}

// ---------------------------------------------------------------- the pen

export type PenEvent =
  | { type: "move"; at: Pt; down: boolean }
  | { type: "stroke"; from: Pt; ctrl: Pt; to: Pt } // quadratic segment to draw
  | { type: "lift" };

export type PenDebug = {
  handVisible: boolean;
  ratio: number | null;
  down: boolean;
  lostForMs: number;
  point: Pt | null;
};

export class FingerPen {
  private fx = new OneEuro();
  private fy = new OneEuro();
  private down = false;
  private lastSeen = -Infinity;
  private lastPoint: Pt | null = null;
  private lastMid: Pt | null = null;
  private lastDrawn: Pt | null = null;
  debug: PenDebug = { handVisible: false, ratio: null, down: false, lostForMs: 0, point: null };

  private w: number;
  private h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  /** Feed one detection result (landmarks or null when no hand). Returns drawing events. */
  update(lm: Landmark[] | null, tMs: number): PenEvent[] {
    const events: PenEvent[] = [];
    if (!lm) {
      const lost = tMs - this.lastSeen;
      // Short gap: keep the stroke alive. Longer: lift the pen.
      if (this.down && lost > PEN.lossGraceMs) {
        this.lift(events);
      }
      this.debug = { ...this.debug, handVisible: false, down: this.down, lostForMs: Math.round(lost) };
      if (lost > PEN.lossGraceMs) {
        this.fx.reset();
        this.fy.reset();
        this.lastPoint = null;
      }
      return events;
    }

    this.lastSeen = tMs;
    const ratio = pinchRatio(lm);
    // Pen tip = midpoint of the pinch, which stays put while the fingers close.
    const raw = mapToCanvas({ x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 }, this.w, this.h);
    const p = { x: this.fx.filter(raw.x, tMs), y: this.fy.filter(raw.y, tMs) };

    const wasDown = this.down;
    if (!this.down && ratio < PEN.downRatio) this.down = true;
    else if (this.down && ratio > PEN.upRatio) this.down = false;

    if (wasDown && !this.down) this.lift(events);
    if (!wasDown && this.down) {
      this.lastPoint = p;
      this.lastMid = p;
      this.lastDrawn = p;
    }

    if (this.down && this.lastPoint && this.lastMid && this.lastDrawn) {
      if (Math.hypot(p.x - this.lastDrawn.x, p.y - this.lastDrawn.y) >= PEN.minMovePx) {
        // Smooth curve: from the previous midpoint, through the previous point, to the new midpoint.
        const mid = { x: (this.lastPoint.x + p.x) / 2, y: (this.lastPoint.y + p.y) / 2 };
        events.push({ type: "stroke", from: this.lastMid, ctrl: this.lastPoint, to: mid });
        this.lastMid = mid;
        this.lastPoint = p;
        this.lastDrawn = p;
      }
    } else {
      this.lastPoint = p;
    }

    events.push({ type: "move", at: p, down: this.down });
    this.debug = { handVisible: true, ratio, down: this.down, lostForMs: 0, point: p };
    return events;
  }

  private lift(events: PenEvent[]) {
    // Finish the stroke with a final straight bit to the last point.
    if (this.lastMid && this.lastPoint) {
      events.push({ type: "stroke", from: this.lastMid, ctrl: this.lastPoint, to: this.lastPoint });
    }
    this.down = false;
    this.lastMid = null;
    this.lastDrawn = null;
    events.push({ type: "lift" });
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
    this.down = false;
    this.lastPoint = this.lastMid = this.lastDrawn = null;
  }
}
