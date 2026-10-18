"use client";

import { useEffect, useState } from "react";

/**
 * A very occasional sparkle over a revealed Bedazzled post. Kept rare and tiny
 * (one at a time, every ~12-25s) so it never pulls focus while studying.
 */
export default function GemTwinkle() {
  const [spark, setSpark] = useState<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let n = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        setSpark({ id: ++n, x: 22 + Math.random() * 56, y: 30 + Math.random() * 40 });
        next();
      }, 12_000 + Math.random() * 13_000);
    };
    next();
    return () => window.clearTimeout(timer);
  }, []);

  if (!spark) return null;
  return <span key={spark.id} className="gem-twinkle" style={{ left: `${spark.x}%`, top: `${spark.y}%` }} aria-hidden="true" />;
}
