// Original glossy app-tile icons for the home screen: rounded squares in the
// pastel palette with a candy highlight and a simple white glyph.

type IconProps = { size?: number };
type Tone = "lime" | "pink" | "sky" | "pearl";

const TONES: Record<Tone, [string, string, string]> = {
  lime: ["#d9f2a6", "#a8d45e", "#7fa83a"],
  pink: ["#fbd6e3", "#efa3bf", "#cf6f95"],
  sky: ["#d3eafb", "#94c8ee", "#5c9fd0"],
  pearl: ["#ffffff", "#e6e2d9", "#b8b1a3"],
};

function Tile({ size = 56, tone, id, children }: IconProps & { tone: Tone; id: string; children: React.ReactNode }) {
  const [hi, lo, edge] = TONES[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="16" fill={`url(#${id}-bg)`} stroke={edge} strokeWidth="1.5" />
      {children}
      {/* Candy highlight across the top half, with a soft reflection at the bottom. */}
      <path d="M8 18 C8 10 12 7 19 7 H45 C52 7 56 10 56 18 V27 C44 31 20 31 8 27 Z" fill={`url(#${id}-shine)`} />
      <ellipse cx="32" cy="55" rx="18" ry="2.5" fill="#fff" opacity="0.35" />
    </svg>
  );
}

const ink = "#3a3a40";

export function CameraIcon({ size }: IconProps) {
  return (
    <Tile size={size} tone="pearl" id="ic-cam">
      <rect x="13" y="21" width="38" height="26" rx="7" fill="#fdfaf3" stroke="#b8b1a3" strokeWidth="1.5" />
      <rect x="22" y="17" width="12" height="6" rx="3" fill="#e6e2d9" stroke="#b8b1a3" strokeWidth="1.2" />
      <circle cx="32" cy="34" r="10" fill="#d9dde3" stroke="#9aa0aa" strokeWidth="1.5" />
      <circle cx="32" cy="34" r="6.5" fill="#3d5878" />
      <circle cx="29.5" cy="31.5" r="2" fill="#fff" opacity="0.9" />
      <circle cx="45" cy="26" r="2" fill="#efa3bf" />
    </Tile>
  );
}

export function PostsIcon({ size }: IconProps) {
  return (
    <Tile size={size} tone="pink" id="ic-posts">
      <rect x="15" y="20" width="24" height="26" rx="4" fill="#fff" opacity="0.7" transform="rotate(-8 27 33)" />
      <rect x="22" y="18" width="26" height="28" rx="4" fill="#fff" />
      <rect x="25" y="21" width="20" height="15" rx="3" fill="#bfe0f7" />
      <path d="M35 44 c-4-3-6-5-6-7.2 a2.6 2.6 0 0 1 6-1.2 a2.6 2.6 0 0 1 6 1.2 c0 2.2-2 4.2-6 7.2z" fill="#efa3bf" />
    </Tile>
  );
}

export function GroupIcon({ size }: IconProps) {
  return (
    <Tile size={size} tone="lime" id="ic-group">
      <circle cx="24" cy="27" r="6" fill="#fff" />
      <path d="M13 45 c0-7 5-11 11-11 s11 4 11 11z" fill="#fff" />
      <circle cx="41" cy="25" r="5" fill="#fff" opacity="0.85" />
      <path d="M32 43 c1-6 5-9 9-9 s9 3 9 9z" fill="#fff" opacity="0.85" />
    </Tile>
  );
}

export function StoryIcon({ size }: IconProps) {
  return (
    <Tile size={size} tone="sky" id="ic-story">
      <path d="M14 22 c6-3 12-3 18 1 v23 c-6-4-12-4-18-1z" fill="#fff" />
      <path d="M50 22 c-6-3-12-3-18 1 v23 c6-4 12-4 18-1z" fill="#fff" opacity="0.9" />
      <path d="M38 28 l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#f2c94c" />
      <path d="M18 30 h9 M18 34 h9 M18 38 h7" stroke="#94c8ee" strokeWidth="1.6" strokeLinecap="round" />
    </Tile>
  );
}

export function WidgetIcon({ size }: IconProps) {
  return (
    <Tile size={size} tone="sky" id="ic-timer">
      <circle cx="32" cy="35" r="13" fill="#fff" stroke="#5c9fd0" strokeWidth="1.5" />
      <rect x="29" y="17" width="6" height="5" rx="2" fill="#fff" stroke="#5c9fd0" strokeWidth="1.2" />
      <path d="M32 35 V27 M32 35 l6 4" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="35" r="1.8" fill="#efa3bf" />
    </Tile>
  );
}

export function HomeIcon({ size }: IconProps) {
  return (
    <Tile size={size} tone="pink" id="ic-home">
      <path d="M15 33 L32 18 L49 33" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 31 V47 H44 V31 L32 21z" fill="#fff" />
      <rect x="28" y="36" width="8" height="11" rx="2.5" fill="#efa3bf" />
    </Tile>
  );
}

export function PlusIcon({ size }: IconProps) {
  return (
    <Tile size={size} tone="lime" id="ic-plus">
      <path d="M32 19 V45 M19 32 H45" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
    </Tile>
  );
}
