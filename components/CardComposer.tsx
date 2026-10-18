"use client";

import { useEffect, useRef, useState } from "react";
import { CARD_H, CARD_STYLES, CARD_W, MAX_CARD_CHARS, drawCardNote, type CardFonts, type CardStyle } from "@/lib/cardNote";

/** Reads the next/font families from the CSS variables set on <html>. */
function readFonts(): CardFonts {
  const css = getComputedStyle(document.documentElement);
  return {
    script: css.getPropertyValue("--font-card").trim() || "cursive",
    mono: css.getPropertyValue("--font-mono").trim() || "monospace",
  };
}

/** Type a note and watch it appear on the card as you write. */
export default function CardComposer({ onCreated }: { onCreated: (image: string, text: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("");
  const [style, setStyle] = useState<CardStyle>("pink");
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
    drawCardNote(canvasRef.current!.getContext("2d")!, text, style, fonts, seed);
  }, [text, style, fonts, seed]);

  const ready = Boolean(fonts && text.trim());

  return (
    <div className="stack">
      <div className="card-frame">
        <canvas ref={canvasRef} width={CARD_W} height={CARD_H} aria-label="Card preview" />
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
      <div className="field-row">
        <span>Card</span>
        <div className="filter-chips" role="radiogroup" aria-label="Card">
          {CARD_STYLES.map((c) => (
            <button key={c.id} role="radio" aria-checked={style === c.id} className={style === c.id ? "small pill-pink" : "small"} onClick={() => setStyle(c.id)}>
              {c.label}
            </button>
          ))}
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
            drawCardNote(canvas.getContext("2d")!, text, style, fonts!, seed);
            onCreated(canvas.toDataURL("image/jpeg", 0.92), text.trim());
          }}
        >
          Use this card
        </button>
      </div>
    </div>
  );
}
