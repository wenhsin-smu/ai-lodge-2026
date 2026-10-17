// An old CRT monitor: beige bezel with sticky notes stuck on it, a curved glass
// screen holding the desktop, and a taskbar along the bottom of the screen.

export default function Monitor({
  children,
  notes,
  taskbar,
  lateNight = false,
}: {
  children: React.ReactNode;
  notes?: React.ReactNode;
  taskbar?: React.ReactNode;
  /** After midnight the screen takes on a warm desk-lamp glow. */
  lateNight?: boolean;
}) {
  return (
    <div className="monitor">
      <div className="monitor-bezel">
        {notes && <div className="bezel-notes">{notes}</div>}
        <div className={lateNight ? "monitor-screen late-night" : "monitor-screen"}>
          <div className="desktop">{children}</div>
          {taskbar && <div className="taskbar">{taskbar}</div>}
          {lateNight && <div className="late-night-tag">still up? 🌙</div>}
          <div className="screen-glare" aria-hidden="true" />
        </div>
        <div className="monitor-brand" aria-hidden="true">
          <span className="monitor-led" /> STUDY·BOOTH CRT-14
        </div>
      </div>
      <div className="monitor-stand" aria-hidden="true" />
    </div>
  );
}
