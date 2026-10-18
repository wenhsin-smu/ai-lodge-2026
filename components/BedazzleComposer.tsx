"use client";

import { useEffect, useRef, useState } from "react";
import {
  CARD_COLORS,
  GEM_COLORS,
  GEM_H,
  GEM_W,
  buildGems,
  drawCard,
  drawGem,
  drawSparkle,
  unsupportedGemChars,
  type CardColor,
  type Gem,
  type GemColor,
} from "@/lib/bedazzleNote";

const MAX_CHARS = 40;
// The whole word pops on in about this long.
const POP_SECONDS = 1.5;
const POP_MS = 160; // each gem's little bounce
const SPARKLE_MS = 650;
const MAX_SPARKLES = 3;

type Phase = "edit" | "popping" | "done";

/** Overshoot then settle: a tiny scale bounce. */
function backOut(t: number) {
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export default function BedazzleComposer({ onCreated }: { onCreated: (image: string, text: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishRef = useRef<() => void>(() => {});
  const [text, setText] = useState("");
  const [gemColor, setGemColor] = useState<GemColor>("crystal");
  const [card, setCard] = useState<CardColor>("pink");
  const [phase, setPhase] = useState<Phase>("edit");
  const [gems, setGems] = useState<Gem[]>([]);
  const [image, setImage] = useState("");
  const [runId, setRunId] = useState(0);

  const unsupported = unsupportedGemChars(text);
  const canMake = buildGems(text, gemColor).length > 0;

  function bedazzle(color = gemColor) {
    const built = buildGems(text, color);
    if (built.length === 0) return;
    setGems(built);
    setImage("");
    setPhase("popping");
    setRunId((n) => n + 1);
  }

  // Pop-on animation, then gentle twinkles on the finished card.
  useEffect(() => {
    if (phase === "edit") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Settled gems are stamped onto this layer once, so each frame stays cheap.
    const settled = document.createElement("canvas");
    settled.width = GEM_W;
    settled.height = GEM_H;
    const sctx = settled.getContext("2d")!;
    drawCard(sctx, card);

    const perGem = (POP_SECONDS * 1000) / Math.max(1, gems.length);
    let start = performance.now();
    let stamped = 0;
    let frame = 0;
    let finished = false;
    const sparkles: { gem: Gem; born: number }[] = [];

    const finish = () => {
      start = -Infinity;
    };
    finishRef.current = finish;
    if (reduceMotion) finish();

    const tick = (now: number) => {
      const elapsed = now - start;
      // Stamp every gem whose bounce has finished.
      while (stamped < gems.length && elapsed >= stamped * perGem + POP_MS) drawGem(sctx, gems[stamped++]);
      ctx.drawImage(settled, 0, 0);
      // Gems still bouncing.
      for (let i = stamped; i < gems.length; i++) {
        const t = (elapsed - i * perGem) / POP_MS;
        if (t <= 0) break;
        drawGem(ctx, gems[i], Math.max(0.2, backOut(Math.min(1, t))));
      }

      if (stamped >= gems.length && !finished) {
        finished = true;
        setImage(canvas.toDataURL("image/jpeg", 0.9));
        setPhase("done");
        if (reduceMotion) return; // no twinkle with reduced motion
      }

      if (finished) {
        // A few gems catch the light now and then.
        if (sparkles.length < MAX_SPARKLES && Math.random() < 0.035) {
          sparkles.push({ gem: gems[Math.floor(Math.random() * gems.length)], born: now });
        }
        for (let i = sparkles.length - 1; i >= 0; i--) {
          const t = (now - sparkles[i].born) / SPARKLE_MS;
          if (t >= 1) sparkles.splice(i, 1);
          else drawSparkle(ctx, sparkles[i].gem.x - sparkles[i].gem.r * 0.35, sparkles[i].gem.y - sparkles[i].gem.r * 0.4, sparkles[i].gem.r * 1.5, t);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // runId restarts the animation for "Watch again" and option changes.
  }, [runId, gems, card]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips = <T extends string>(items: { id: T; label: string }[], value: T, set: (v: T) => void, label: string) => (
    <div className="field-row">
      <span>{label}</span>
      <div className="filter-chips" role="radiogroup" aria-label={label}>
        {items.map((it) => (
          <button
            key={it.id}
            role="radio"
            aria-checked={value === it.id}
            className={value === it.id ? "small pill-pink" : "small"}
            onClick={() => set(it.id)}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="stack">
      {phase === "edit" ? (
        <>
          <div className="field-row-stacked">
            <label htmlFor="gem-note">Your note</label>
            <textarea
              id="gem-note"
              rows={2}
              maxLength={MAX_CHARS}
              value={text}
              placeholder="Lucky"
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          {chips(GEM_COLORS, gemColor, setGemColor, "Gems")}
          {chips(CARD_COLORS, card, setCard, "Card")}
          <div className="field-row" style={{ justifyContent: "space-between" }}>
            <span className="hint">
              {text.length}/{MAX_CHARS}
            </span>
            <button className="pill-pink" onClick={() => bedazzle()} disabled={!canMake}>
              Bedazzle it ✨
            </button>
          </div>
          {unsupported.length > 0 && <p className="hint">These can&apos;t be made in gems and will be skipped: {unsupported.join(" ")}</p>}
        </>
      ) : (
        <>
          <div className="gem-frame">
            <canvas ref={canvasRef} width={GEM_W} height={GEM_H} />
          </div>
          {phase === "done" && (
            <>
              {chips(
                GEM_COLORS,
                gemColor,
                (c) => {
                  setGemColor(c);
                  bedazzle(c);
                },
                "Gems",
              )}
              {chips(
                CARD_COLORS,
                card,
                (c) => {
                  setCard(c);
                  setRunId((n) => n + 1);
                  setPhase("popping");
                },
                "Card",
              )}
            </>
          )}
          <div className="field-row">
            {phase === "popping" ? (
              <button onClick={() => finishRef.current()}>Finish now</button>
            ) : (
              <>
                <button onClick={() => setPhase("edit")}>Edit</button>
                <button
                  className="pill-pink"
                  onClick={() => {
                    setPhase("popping");
                    setRunId((n) => n + 1);
                  }}
                >
                  Watch again
                </button>
                <button
                  className="pill-green"
                  onClick={() => {
                    onCreated(image, text.trim());
                    setText("");
                    setPhase("edit");
                  }}
                >
                  Use this note
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
