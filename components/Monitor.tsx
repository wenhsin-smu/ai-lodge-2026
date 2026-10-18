// The signed-out screens (welcome, sign-in): a glossy pearl top bar over the
// soft cream-to-sky background.

export default function Monitor({ children }: { children: React.ReactNode }) {
  return (
    <div className="monitor">
      <header className="desk-bar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Study Booth
        </div>
      </header>
      <div className="desk-surface">
        <div className="desktop">{children}</div>
      </div>
    </div>
  );
}
