"use client";

import { useEffect, useRef, useState } from "react";
import {
  NOTE_H,
  NOTE_W,
  buildStitches,
  drawFabric,
  drawNeedle,
  drawStitch,
  unsupportedChars,
  type Stitch,
} from "@/lib/stitchNote";

const MAX_CHARS = 60;
// The whole note stitches in about this long, however long it is.
const STITCH_SECONDS = 1.8;
const NEEDLE_LIFT = 10;

type Phase = "edit" | "stitching" | "done";

export default function NoteComposer({ onStitched }: { onStitched: (image: string, text: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishRef = useRef<() => void>(() => {});
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("edit");
  const [stitches, setStitches] = useState<Stitch[]>([]);
  const [image, setImage] = useState("");

  const unsupported = unsupportedChars(text);

  function stitch() {
    const built = buildStitches(text);
    if (built.length === 0) return;
    setStitches(built);
    setImage("");
    setPhase("stitching");
  }

  // Stitching animation: completed stitches go onto an offscreen layer; each
  // frame composes fabric + embroidery + the needle bobbing at the newest stitch.
  useEffect(() => {
    if (phase !== "stitching") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const fabric = document.createElement("canvas");
    fabric.width = NOTE_W;
    fabric.height = NOTE_H;
    drawFabric(fabric.getContext("2d")!);
    const embroidery = document.createElement("canvas");
    embroidery.width = NOTE_W;
    embroidery.height = NOTE_H;
    const embCtx = embroidery.getContext("2d")!;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rate = Math.max(25, stitches.length / STITCH_SECONDS);
    let start = performance.now();
    let drawn = 0;
    let frame = 0;

    const finish = () => {
      start = -Infinity;
    };
    finishRef.current = finish;
    if (reduceMotion) finish();

    const tick = (now: number) => {
      const progress = Math.min(stitches.length, ((now - start) / 1000) * rate);
      const target = Math.floor(progress);
      while (drawn < target) drawStitch(embCtx, stitches[drawn++]);

      ctx.drawImage(fabric, 0, 0);
      ctx.drawImage(embroidery, 0, 0);

      if (drawn >= stitches.length) {
        setImage(canvas.toDataURL("image/jpeg", 0.9));
        setPhase("done");
        return;
      }
      // Needle dips into the fabric at the end of each stitch and lifts between them.
      const current = stitches[drawn];
      const lift = Math.sin((progress - target) * Math.PI) * NEEDLE_LIFT;
      drawNeedle(ctx, current.b, lift, current.color);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, stitches]);

  function send() {
    onStitched(image, text.trim());
    setText("");
    setPhase("edit");
  }

  return (
    <div className="stack">
      {phase === "edit" ? (
        <>
          <div className="field-row-stacked">
            <label htmlFor="note">Your note</label>
            <textarea
              id="note"
              rows={3}
              maxLength={MAX_CHARS}
              value={text}
              placeholder="it's all in your head"
              onChange={(e) => {
                setText(e.target.value);
              }}
            />
          </div>
          <div className="field-row" style={{ justifyContent: "space-between" }}>
            <span>
              {text.length}/{MAX_CHARS}
            </span>
            <button className="pill-green" onClick={stitch} disabled={buildStitches(text).length === 0}>
              Stitch it
            </button>
          </div>
          {unsupported.length > 0 && <p>These can&apos;t be stitched and will be skipped: {unsupported.join(" ")}</p>}
        </>
      ) : (
        <>
          <div className="hoop-frame">
            <canvas ref={canvasRef} width={NOTE_W} height={NOTE_H} />
          </div>
          <div className="field-row">
            {phase === "stitching" ? (
              <button onClick={() => finishRef.current()}>Finish now</button>
            ) : (
              <>
                <button onClick={() => setPhase("edit")}>Edit</button>
                <button className="pill-pink" onClick={() => setPhase("stitching")}>
                  Watch again
                </button>
                <button className="pill-green" onClick={send}>
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
