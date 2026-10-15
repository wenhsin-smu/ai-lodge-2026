"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ScratchCard from "@/components/ScratchCard";
import { useLocalPosts } from "@/components/useLocalPosts";

const LATEST = 3;

type DocumentPiP = {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
  window: Window | null;
};

function getDocumentPiP(): DocumentPiP | null {
  return (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture ?? null;
}

// Copies the page's styles (98.css + globals) into the PiP window.
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
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

export default function PopOut({ eraserSize }: { eraserSize: number }) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => pipWindow?.close();
  }, [pipWindow]);

  async function open() {
    const pip = getDocumentPiP();
    if (!pip) {
      setMessage("Pop out needs Chrome or Edge (version 116 or newer). Everything else still works here.");
      return;
    }
    if (pip.window) {
      pip.window.focus();
      return;
    }
    try {
      const win = await pip.requestWindow({ width: 300, height: 480 });
      copyStyles(win.document);
      win.document.title = "Study Booth";
      win.document.body.className = "pip";
      win.addEventListener("pagehide", () => setPipWindow(null));
      setPipWindow(win);
    } catch {
      setMessage("Couldn't open the pop-out window.");
    }
  }

  return (
    <>
      <button onClick={open}>Pop out</button>
      {message && <p role="alert">{message}</p>}
      {pipWindow && createPortal(<Widget eraserSize={eraserSize} />, pipWindow.document.body)}
    </>
  );
}

function Widget({ eraserSize }: { eraserSize: number }) {
  const posts = useLocalPosts().slice(0, LATEST);

  return (
    <div className="window" style={{ maxWidth: "none" }}>
      <div className="title-bar">
        <div className="title-bar-text">Study Booth</div>
      </div>
      <div className="window-body stack">
        <button
          onClick={() => {
            window.focus();
            document.getElementById("booth")?.scrollIntoView();
          }}
        >
          New post
        </button>
        {posts.length === 0 ? (
          <p>Quiet for now. Posts from your group will show up here.</p>
        ) : (
          posts.map((p) => <ScratchCard key={p.id} post={p} eraserSize={eraserSize} />)
        )}
      </div>
    </div>
  );
}
