// Original pixel-style desktop icons (drawn for Study Booth, 32x32 grid).

type IconProps = { size?: number };

const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true">
    {children}
  </svg>
);

export function CameraIcon({ size = 40 }: IconProps) {
  return svg(
    size,
    <>
      <rect x="3" y="9" width="26" height="17" fill="#3b3b46" />
      <rect x="4" y="10" width="24" height="15" fill="#e8b04b" />
      <rect x="10" y="6" width="8" height="4" fill="#3b3b46" />
      <rect x="11" y="7" width="6" height="3" fill="#c98a2b" />
      <rect x="11" y="12" width="11" height="11" fill="#3b3b46" />
      <rect x="12" y="13" width="9" height="9" fill="#7fc8e8" />
      <rect x="14" y="15" width="3" height="3" fill="#ffffff" />
      <rect x="23" y="12" width="3" height="2" fill="#fff6d8" />
    </>,
  );
}

export function PostsIcon({ size = 40 }: IconProps) {
  return svg(
    size,
    <>
      <rect x="6" y="5" width="20" height="23" fill="#3b3b46" />
      <rect x="7" y="6" width="18" height="21" fill="#fffdf4" />
      <rect x="9" y="8" width="14" height="10" fill="#b6b9bf" />
      <rect x="10" y="9" width="5" height="1" fill="#ffffff" />
      <rect x="10" y="11" width="3" height="1" fill="#ffffff" />
      <rect x="9" y="20" width="12" height="1" fill="#9aa0a8" />
      <rect x="9" y="22" width="9" height="1" fill="#9aa0a8" />
      <rect x="20" y="2" width="9" height="9" fill="#3b3b46" />
      <rect x="21" y="3" width="7" height="7" fill="#ef6f6c" />
      <rect x="24" y="4" width="1" height="3" fill="#ffffff" />
      <rect x="24" y="8" width="1" height="1" fill="#ffffff" />
    </>,
  );
}

export function GroupIcon({ size = 40 }: IconProps) {
  return svg(
    size,
    <>
      <rect x="5" y="8" width="8" height="8" fill="#3b3b46" />
      <rect x="6" y="9" width="6" height="6" fill="#f2c9a0" />
      <rect x="3" y="17" width="12" height="10" fill="#3b3b46" />
      <rect x="4" y="18" width="10" height="9" fill="#5b8def" />
      <rect x="19" y="8" width="8" height="8" fill="#3b3b46" />
      <rect x="20" y="9" width="6" height="6" fill="#c98f62" />
      <rect x="17" y="17" width="12" height="10" fill="#3b3b46" />
      <rect x="18" y="18" width="10" height="9" fill="#52b788" />
      <rect x="14" y="4" width="4" height="4" fill="#ef6f6c" />
      <rect x="13" y="5" width="6" height="2" fill="#ef6f6c" />
      <rect x="15" y="8" width="2" height="1" fill="#ef6f6c" />
    </>,
  );
}

export function StoryIcon({ size = 40 }: IconProps) {
  return svg(
    size,
    <>
      <rect x="4" y="6" width="24" height="21" fill="#3b3b46" />
      <rect x="5" y="7" width="10" height="19" fill="#fffdf4" />
      <rect x="17" y="7" width="10" height="19" fill="#fffdf4" />
      <rect x="15" y="7" width="2" height="19" fill="#8c5a3c" />
      <rect x="7" y="10" width="6" height="1" fill="#9aa0a8" />
      <rect x="7" y="13" width="6" height="1" fill="#9aa0a8" />
      <rect x="7" y="16" width="4" height="1" fill="#9aa0a8" />
      <rect x="19" y="10" width="6" height="5" fill="#f7d154" />
      <rect x="19" y="17" width="6" height="1" fill="#9aa0a8" />
      <rect x="19" y="20" width="5" height="1" fill="#9aa0a8" />
    </>,
  );
}

export function WidgetIcon({ size = 40 }: IconProps) {
  return svg(
    size,
    <>
      <rect x="4" y="4" width="24" height="24" fill="#3b3b46" />
      <rect x="5" y="5" width="22" height="22" fill="#d7d3c8" />
      <rect x="5" y="5" width="22" height="4" fill="#2f5d8a" />
      <rect x="22" y="6" width="3" height="2" fill="#d7d3c8" />
      <rect x="9" y="12" width="14" height="12" fill="#3b3b46" />
      <rect x="10" y="13" width="12" height="10" fill="#fffdf4" />
      <rect x="15" y="14" width="2" height="5" fill="#3b3b46" />
      <rect x="16" y="18" width="4" height="2" fill="#3b3b46" />
    </>,
  );
}
