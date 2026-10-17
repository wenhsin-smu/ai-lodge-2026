// The home screen "desk": a glossy pearl top bar, pastel sticky notes and the
// gadget windows on a soft cream-to-sky background.

export default function Monitor({
  children,
  notes,
  taskbar,
  lateNight = false,
}: {
  children: React.ReactNode;
  notes?: React.ReactNode;
  taskbar?: React.ReactNode;
  /** After midnight the desk takes on a warm lamp glow. */
  lateNight?: boolean;
}) {
  return (
    <div className={lateNight ? "monitor late-night" : "monitor"}>
      <header className="desk-bar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Study Booth
        </div>
        {lateNight && <span className="late-night-tag">still up? 🌙</span>}
        {taskbar && <div className="taskbar">{taskbar}</div>}
      </header>
      <div className="desk-surface">
        {notes && <div className="bezel-notes">{notes}</div>}
        <div className="desktop">{children}</div>
      </div>
    </div>
  );
}
