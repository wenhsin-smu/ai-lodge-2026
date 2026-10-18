"use client";

import { useEffect, useRef, useState } from "react";
import {
  CARD_COLORS,
  CARD_H,
  CARD_W,
  MAX_CARD_CHARS,
  MAX_STAMPS,
  STAMP_KINDS,
  TEXT_SIZE,
  defaultStamps,
  drawCardNote,
  makeStamp,
  type CardAlign,
  type CardColor,
  type CardFonts,
  type Stamp,
  type StampKind,
} from "@/lib/cardNote";

const STAMP_GLYPHS: Record<StampKind, string> = { star: "★", heart: "♥", smiley: "☺", moon: "☾", dots: "⁘" };
const ALIGNS: { id: CardAlign; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "center", label: "Centre" },
  { id: "right", label: "Right" },
];
const NUDGE = 16;

/** Reads the next/font families from the CSS variables set on <html>. */
function readFonts(): CardFonts {
  const css = getComputedStyle(document.documentElement);
  return {
    script: css.getPropertyValue("--font-card").trim() || "cursive",
    mono: css.getPropertyValue("--font-mono").trim() || "monospace",
  };
}

/** Type a note and watch it appear on the card; then colour it, size it and stamp it. */
export default function CardComposer({ onCreated }: { onCreated: (image: string, text: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("");
  const [color, setColor] = useState<CardColor>("pink");
  const [align, setAlign] = useState<CardAlign>("center");
  const [size, setSize] = useState(TEXT_SIZE.default);
  const [stamps, setStamps] = useState<Stamp[]>(defaultStamps);
  const [tool, setTool] = useState<StampKind | null>(null);
  const [ghost, setGhost] = useState<Stamp | null>(null);
  const [fonts, setFonts] = useState<CardFonts | null>(null);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));

  // Wait for the script font so the first draw isn't in a fallback font.
  useEffect(() => {
    const f = readFonts();
    let live = true;
    Promise.all([document.fonts.load(`64px ${f.script}`), document.fonts.load(`16px ${f.mono}`)])
      .catch(() => {})
      .then(() => live && setFonts(f));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!fonts) return;
    drawCardNote(canvasRef.current!.getContext("2d")!, text, { color, align, size, stamps }, fonts, seed, tool ? ghost : null);
  }, [text, color, align, size, stamps, fonts, seed, tool, ghost]);

  const full = stamps.length >= MAX_STAMPS;

  function toCard(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * CARD_W, y: ((e.clientY - rect.top) / rect.height) * CARD_H };
  }

  function press(at: Stamp) {
    if (full) return;
    setStamps((s) => [...s, at]);
    // A fresh rotation and size for the next press, same place.
    setGhost(makeStamp(at.kind, at.x, at.y));
  }

  function pickTool(kind: StampKind) {
    const next = tool === kind ? null : kind;
    setTool(next);
    setGhost(next ? makeStamp(next, ghost?.x ?? CARD_W / 2, ghost?.y ?? CARD_H / 2) : null);
  }

  const ready = Boolean(fonts && text.trim());

  return (
    <div className="stack">
      <div className="card-frame">
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          className={tool ? "stamping" : undefined}
          tabIndex={tool ? 0 : -1}
          aria-label={tool ? `Card preview. Click to stamp a ${tool}, or use the arrow keys and Enter.` : "Card preview"}
          onPointerMove={(e) => {
            if (!tool) return;
            const p = toCard(e);
            setGhost((g) => (g ? { ...g, x: p.x, y: p.y } : makeStamp(tool, p.x, p.y)));
          }}
          onPointerLeave={() => tool && setGhost(null)}
          onPointerDown={(e) => {
            if (!tool) return;
            const p = toCard(e);
            press(ghost ? { ...ghost, x: Math.round(p.x), y: Math.round(p.y) } : makeStamp(tool, p.x, p.y));
          }}
          onKeyDown={(e) => {
            if (!tool) return;
            const g = ghost ?? makeStamp(tool, CARD_W / 2, CARD_H / 2);
            const moves: Record<string, [number, number]> = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] };
            if (moves[e.key]) {
              e.preventDefault();
              const [dx, dy] = moves[e.key];
              setGhost({ ...g, x: Math.min(CARD_W, Math.max(0, g.x + dx)), y: Math.min(CARD_H, Math.max(0, g.y + dy)) });
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              press(g);
            }
          }}
        />
      </div>

      <div className="field-row-stacked">
        <label htmlFor="card-note">Your note</label>
        <textarea
          id="card-note"
          rows={2}
          maxLength={MAX_CARD_CHARS}
          value={text}
          placeholder="Study break?"
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="card-controls">
        <div className="field-row">
          <span className="control-label">Colour</span>
          <div className="filter-chips" role="radiogroup" aria-label="Card colour">
            {CARD_COLORS.map((c) => (
              <button key={c.id} role="radio" aria-checked={color === c.id} className={color === c.id ? "small pill-pink" : "small"} onClick={() => setColor(c.id)}>
                <span className="swatch" style={{ background: c.swatch }} aria-hidden="true" />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="control-label" htmlFor="card-size">
            Text size
          </label>
          <input id="card-size" type="range" min={TEXT_SIZE.min} max={TEXT_SIZE.max} step={2} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          <div className="filter-chips" role="radiogroup" aria-label="Alignment">
            {ALIGNS.map((a) => (
              <button key={a.id} role="radio" aria-checked={align === a.id} className={align === a.id ? "small pill-blue" : "small"} onClick={() => setAlign(a.id)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <span className="control-label">Stamps</span>
          <div className="filter-chips" role="radiogroup" aria-label="Stamp">
            {STAMP_KINDS.map((s) => (
              <button key={s.id} role="radio" aria-checked={tool === s.id} className={tool === s.id ? "small pill-green" : "small"} onClick={() => pickTool(s.id)}>
                <span aria-hidden="true">{STAMP_GLYPHS[s.id]}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <span className="hint stamp-hint">
            {full
              ? `That's ${MAX_STAMPS} stamps, the most a card can take.`
              : tool
                ? `Click anywhere on the card to stamp a ${tool}.`
                : "Pick a stamp, then click the card where you want it."}
          </span>
          <button className="small" disabled={stamps.length === 0} onClick={() => setStamps((s) => s.slice(0, -1))}>
            Undo stamp
          </button>
          <button className="small" disabled={stamps.length === 0} onClick={() => setStamps([])}>
            Clear stamps
          </button>
        </div>
      </div>

      <div className="field-row" style={{ justifyContent: "space-between" }}>
        <span className="hint">
          {text.length}/{MAX_CARD_CHARS}
        </span>
        <button
          className="pill-green"
          disabled={!ready}
          onClick={() => {
            const canvas = canvasRef.current!;
            // Final render without the stamp preview.
            drawCardNote(canvas.getContext("2d")!, text, { color, align, size, stamps }, fonts!, seed);
            onCreated(canvas.toDataURL("image/jpeg", 0.92), text.trim());
          }}
        >
          Use this card
        </button>
      </div>
    </div>
  );
}
