"use client";

import { useEffect, useRef, useState } from "react";
import { markRevealed, type LocalPost } from "@/lib/localPosts";

const CW = 320;
const CH = 240;
const REVEAL_AT = 0.6;

export default function ScratchCard({ post, eraserSize }: { post: LocalPost; eraserSize: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const moves = useRef(0);
  const [fading, setFading] = useState(false);

  const covered = !post.revealed && !post.fromMe;

  useEffect(() => {
    if (!covered) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = "#b8b8b8";
    ctx.fillRect(0, 0, CW, CH);
    // Simple diagonal hatch so the cover reads as scratchable foil.
    ctx.strokeStyle = "#a6a6a6";
    ctx.lineWidth = 2;
    for (let x = -CH; x < CW; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, CH);
      ctx.lineTo(x + CH, 0);
      ctx.stroke();
    }
    ctx.fillStyle = "#555";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`From ${post.author}: scratch to reveal`, CW / 2, CH / 2);
  }, [covered, post.author]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * CW, y: ((e.clientY - rect.top) / rect.height) * CH };
  }

  function scratch(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = eraserSize;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + 0.1, to.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function checkProgress() {
    const data = canvasRef.current!.getContext("2d")!.getImageData(0, 0, CW, CH).data;
    let cleared = 0;
    let total = 0;
    // Sample every 4th pixel in each direction.
    for (let y = 0; y < CH; y += 4) {
      for (let x = 0; x < CW; x += 4) {
        total++;
        if (data[(y * CW + x) * 4 + 3] < 128) cleared++;
      }
    }
    if (cleared / total >= REVEAL_AT && !fading) {
      setFading(true);
      setTimeout(() => markRevealed(post.id), 400);
    }
  }

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ position: "relative", aspectRatio: `${CW} / ${CH}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.image} alt={`Post from ${post.author}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {covered && (
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              cursor: "pointer",
              touchAction: "none",
              opacity: fading ? 0 : 1,
              transition: "opacity 400ms ease-out",
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = point(e);
              scratch(p, p);
              last.current = p;
            }}
            onPointerMove={(e) => {
              if (!last.current) return;
              const p = point(e);
              scratch(last.current, p);
              last.current = p;
              if (++moves.current % 10 === 0) checkProgress();
            }}
            onPointerUp={() => {
              last.current = null;
              checkProgress();
            }}
            onPointerCancel={() => {
              last.current = null;
            }}
          />
        )}
      </div>
      <figcaption style={{ marginTop: 4 }}>
        <b>{post.author}</b>
        {post.caption && (covered ? "" : `: ${post.caption}`)}
      </figcaption>
    </figure>
  );
}
