"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import ScratchCard from "@/components/ScratchCard";
import { postStyle, useBooth } from "@/components/BoothProvider";
import { useFeed } from "@/components/useFeed";

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

type Pip = { supported: boolean; isOpen: boolean; open: () => Promise<void> };
const PipContext = createContext<Pip>({ supported: false, isOpen: false, open: async () => {} });
export const usePip = () => useContext(PipContext);

/**
 * Owns the small always-on-top study widget. It pops out with Document
 * Picture-in-Picture in Chrome/Edge and stays open while you switch tabs.
 */
export function PipProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
    const win = await pip.requestWindow({ width: 300, height: 420 });
    copyStyles(win.document);
    win.document.title = "Study Booth";
    win.document.body.className = "pip";
    win.addEventListener("pagehide", () => setPipWindow(null));
    setPipWindow(win);
  }

  const newPost = () => {
    window.focus();
    router.push("/?new=1");
  };

  return (
    <PipContext.Provider value={{ supported, isOpen: Boolean(pipWindow), open }}>
      {children}
      {pipWindow && createPortal(<WidgetBody onNewPost={newPost} />, pipWindow.document.body)}
    </PipContext.Provider>
  );
}

function WidgetBody({ onNewPost }: { onNewPost: () => void }) {
  const { group, checkins } = useBooth();
  const latestCheckin = checkins[0];

  return (
    <div className="window widget-window">
      <div className="title-bar">
        <div className="title-bar-text">Study Booth{group ? ` · ${group.name}` : ""}</div>
      </div>
      <div className="window-body stack">
        <MiniTimer />
        {latestCheckin && <div className="sticky-note small-note">{latestCheckin.message}</div>}
        <WidgetThumbs />
        <button className="pill-green" onClick={onNewPost}>
          New post
        </button>
      </div>
    </div>
  );
}

/** The last three posts as small scratch cards. */
function WidgetThumbs() {
  const { imageUrls, reveal } = useBooth();
  const { shown, authorOf, isCovered } = useFeed();
  const latest = shown.slice(0, LATEST);
  if (latest.length === 0) return <p className="hint">No posts yet today.</p>;
  return (
    <div className="widget-thumbs">
      {latest.map((p) => (
        <ScratchCard
          key={p.id}
          postId={p.id}
          imageUrl={imageUrls[p.image_path]}
          author={authorOf(p)}
          covered={isCovered(p)}
          eraserSize={90}
          onRevealed={() => void reveal(p.id)}
          twinkle={postStyle(p) === "Bedazzled"}
        />
      ))}
    </div>
  );
}

export function formatLeft(ms: number) {
  const left = Math.max(0, ms);
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

/** Ticks once a second while a study session is running. */
export function useSessionLeft() {
  const { session } = useBooth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [session]);
  return session ? session.endsAt - now : null;
}

function MiniTimer() {
  const { group, session, startStudy, stopStudy } = useBooth();
  const left = useSessionLeft();
  if (!group) return null;
  if (!session || left === null) {
    return (
      <button className="pill-blue" onClick={() => void startStudy(50, false).catch(() => {})}>
        Start a 50 min session
      </button>
    );
  }
  return (
    <div className="field-row mini-timer">
      <div className="timer-readout">{formatLeft(left)}</div>
      <button className="small" onClick={() => void stopStudy()}>
        End
      </button>
    </div>
  );
}
