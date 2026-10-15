"use client";

import { useEffect, useRef, useState } from "react";
import { markRevealed, type LocalPost } from "@/lib/localPosts";

const CW = 320;
const CH = 240;
const REVEAL_AT = 0.6;

type Props = { post: LocalPost; viewerId: string; eraserSize: number };

export default function ScratchCard({ post, viewerId, eraserSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const moves = useRef(0);
  const [fading, setFading] = useState(false);

  // Friends' posts stay covered until this viewer scratches them; your own never are.
  const mine = post.authorId === viewerId;
  const covered = !mine && !post.revealedBy.includes(viewerId);

  useEffect(() => {
    if (!covered) return;
    drawFoil(canvasRef.current!.getContext("2d")!, `From ${post.author}`, post.id);
  }, [covered, post.author, post.id]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * CW, y: ((e.clientY - rect.top) / rect.height) * CH };
  }

  function scratch(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000"; // must be opaque so each stroke fully clears the foil
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
        <b>{mine ? "You" : post.author}</b>
        {post.caption && (covered ? "" : `: ${post.caption}`)}
      </figcaption>
    </figure>
  );
}

/** Silver scratch-card foil, like a lottery ticket. */
function drawFoil(ctx: CanvasRenderingContext2D, label: string, seed: string) {
  const foil = ctx.createLinearGradient(0, 0, CW, CH);
  foil.addColorStop(0, "#9ea2a8");
  foil.addColorStop(0.3, "#e4e6e9");
  foil.addColorStop(0.5, "#b4b8be");
  foil.addColorStop(0.75, "#eceef0");
  foil.addColorStop(1, "#a3a7ad");
  ctx.fillStyle = foil;
  ctx.fillRect(0, 0, CW, CH);

  // Metallic grain and a few glints. Seeded by post id so it doesn't change on re-render.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => ((h = (h * 1103515245 + 12345) | 0) >>> 8) / 16777216;
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${rand() * 0.35})` : `rgba(60,64,70,${rand() * 0.18})`;
    ctx.fillRect(rand() * CW, rand() * CH, 1, 1);
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 6; i++) {
    const x = rand() * CW;
    const y = rand() * CH;
    const r = 2 + rand() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2);
    ctx.lineTo(x + r * 0.4, y);
    ctx.lineTo(x, y + r * 2);
    ctx.lineTo(x - r * 0.4, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - r * 2, y - 0.5, r * 4, 1);
  }

  // Inset label panel.
  ctx.strokeStyle = "rgba(70,74,80,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(14, 14, CW - 28, CH - 28);
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("SCRATCH HERE", CW / 2 + 1, CH / 2 - 9);
  ctx.fillStyle = "#3f444b";
  ctx.fillText("SCRATCH HERE", CW / 2, CH / 2 - 10);
  ctx.font = "15px sans-serif";
  ctx.fillText(label, CW / 2, CH / 2 + 20);
}
