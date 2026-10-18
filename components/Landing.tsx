// The signed-out landing page: "Study Booth" writes itself out in script,
// then the tagline, a few feature chips and the sign-in card float in.
// All animation is CSS (see "landing" in globals.css) and switches off with
// prefers-reduced-motion.

import AuthCard from "@/components/AuthCard";

const FEATURES = ["Fog-glass doodles", "Handwritten card notes", "Scratch to reveal", "Floating study widget"];

export default function Landing({ notice }: { notice?: React.ReactNode }) {
  return (
    <main className="landing">
      <div className="landing-bubbles" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={`bubble bubble-${i}`} />
        ))}
      </div>

      <h1 className="landing-title">
        <span className="sr-only">Study Booth</span>
        <svg viewBox="0 0 1000 230" role="presentation" aria-hidden="true">
          <defs>
            <linearGradient id="title-ink" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e2709f" />
              <stop offset="0.5" stopColor="#a77fd6" />
              <stop offset="1" stopColor="#4f97d6" />
            </linearGradient>
          </defs>
          <g className="title-write">
            <text x="500" y="170" textAnchor="middle" className="title-shadow">
              Study Booth
            </text>
            <text x="500" y="165" textAnchor="middle" className="title-ink">
              Study Booth
            </text>
          </g>
        </svg>
        <span className="title-pen" aria-hidden="true" />
      </h1>

      <p className="landing-tagline">Study apart, together.</p>
      <p className="landing-blurb">
        Share tiny handmade photos and notes with your study friends. They arrive under silver foil, and friends scratch to reveal them.
      </p>
      <ul className="landing-features" aria-label="Features">
        {FEATURES.map((f, i) => (
          <li key={f} style={{ animationDelay: `${3.1 + i * 0.12}s` }}>
            {f}
          </li>
        ))}
      </ul>

      <div className="landing-auth">{notice ?? <AuthCard />}</div>
    </main>
  );
}
