"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import PostList from "@/components/PostList";
import { useBooth } from "@/components/BoothProvider";

const LATEST = 3;
const noSubscribe = () => () => {};

type DocumentPiP = {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
  window: Window | null;
};

function getDocumentPiP(): DocumentPiP | null {
  return (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture ?? null;
}

// Copies the page's styles and font classes into the PiP window. External sheets
// are linked (not inlined) so relative URLs like the web fonts still resolve.
function copyStyles(target: Document) {
  target.documentElement.className = document.documentElement.className;
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.href) {
      const link = target.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      target.head.appendChild(link);
      continue;
    }
    try {
      const style = target.createElement("style");
      style.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      target.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}

/**
 * The small always-on-top study widget. Pops out with Document Picture-in-Picture
 * in Chrome/Edge; elsewhere it stays as a panel on the page.
 */
export default function WidgetLauncher({ onNewPost }: { onNewPost: () => void }) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const supported = useSyncExternalStore(
    noSubscribe,
    () => Boolean(getDocumentPiP()),
    () => true,
  );

  useEffect(() => {
    return () => pipWindow?.close();
  }, [pipWindow]);

  async function open() {
    const pip = getDocumentPiP();
    if (!pip) return;
    if (pip.window) {
      pip.window.focus();
      return;
    }
    const win = await pip.requestWindow({ width: 300, height: 520 });
    copyStyles(win.document);
    win.document.title = "Study Booth";
    win.document.body.className = "pip";
    win.addEventListener("pagehide", () => setPipWindow(null));
    setPipWindow(win);
  }

  const newPost = () => {
    window.focus();
    onNewPost();
  };

  return (
    <div className="stack">
      {supported ? (
        <div className="field-row">
          <button className="pill-blue" onClick={open}>{pipWindow ? "Widget is popped out" : "Pop out widget"}</button>
        </div>
      ) : (
        <p className="hint">Pop-out needs Chrome or Edge, so the widget lives here on the page instead.</p>
      )}
      {pipWindow ? (
        createPortal(<WidgetBody onNewPost={newPost} />, pipWindow.document.body)
      ) : (
        <WidgetBody onNewPost={newPost} inline />
      )}
    </div>
  );
}

function WidgetBody({ onNewPost, inline = false }: { onNewPost: () => void; inline?: boolean }) {
  const { group, checkins } = useBooth();
  const latestCheckin = checkins[0];

  return (
    <div className={inline ? "widget-inline" : "window widget-window"}>
      {!inline && (
        <div className="title-bar">
          <div className="title-bar-text">Study Booth{group ? ` · ${group.name}` : ""}</div>
        </div>
      )}
      <div className={inline ? "stack" : "window-body stack"}>
        <StudyTimer />
        <button className="pill-green" onClick={onNewPost}>
          New post
        </button>
        {latestCheckin && <div className="sticky-note small-note">{latestCheckin.message}</div>}
        <PostList limit={LATEST} eraserSize={26} compact />
      </div>
    </div>
  );
}

export function StudyTimer() {
  const { group, session, startStudy, stopStudy, setFocus } = useBooth();
  const [minutes, setMinutes] = useState(50);
  const [focus, setFocusChoice] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [session]);

  if (!group) return null;

  if (!session) {
    return (
      <fieldset>
        <legend>Study timer</legend>
        <div className="field-row">
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Timer length">
            {[25, 50, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
          <input id="focus-choice" type="checkbox" checked={focus} onChange={(e) => setFocusChoice(e.target.checked)} />
          <label htmlFor="focus-choice">Focus mode</label>
        </div>
        <button
          className="pill-blue"
          onClick={() => {
            setError("");
            startStudy(minutes, focus).catch((e: Error) => setError(e.message));
          }}
        >
          Start studying
        </button>
        {error && <p className="hint">{error}</p>}
      </fieldset>
    );
  }

  const left = Math.max(0, session.endsAt - now);
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  return (
    <fieldset>
      <legend>Studying</legend>
      <div className="timer-readout">
        {mm}:{ss.toString().padStart(2, "0")}
      </div>
      <div className="field-row">
        <input id="focus-live" type="checkbox" checked={session.focus} onChange={(e) => setFocus(e.target.checked)} />
        <label htmlFor="focus-live">Focus mode (hide new posts)</label>
      </div>
      <button className="pill-blue" onClick={() => void stopStudy()}>
        End session
      </button>
    </fieldset>
  );
}
