"use client";

import { useEffect, useState } from "react";
import FogBooth from "@/components/FogBooth";
import NoteComposer from "@/components/NoteComposer";
import { useBooth, type PostKind } from "@/components/BoothProvider";

type Tab = "photo" | "fog" | "note";
type Draft = { image: string; kind: PostKind; noteText?: string };

export default function NewPost() {
  const [tab, setTab] = useState<Tab>("photo");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="stack">
      <menu role="tablist">
        <Tab label="Photo" tone="green" selected={tab === "photo"} onSelect={() => setTab("photo")} />
        <Tab label="Fog glass" tone="pink" selected={tab === "fog"} onSelect={() => setTab("fog")} />
        <Tab label="Stitched note" tone="blue" selected={tab === "note"} onSelect={() => setTab("note")} />
      </menu>
      <div className="window" role="tabpanel">
        <div className="window-body stack">
          {/* Keyed by tab so switching modes restarts the camera with or without the mic. */}
          {tab !== "note" ? (
            <FogBooth
              key={tab}
              fog={tab === "fog"}
              hidden={Boolean(draft)}
              onCapture={(image, kind) => {
                setLastResult(null);
                setDraft({ image, kind });
              }}
            />
          ) : (
            !draft && (
              <NoteComposer
                onStitched={(image, noteText) => {
                  setLastResult(null);
                  setDraft({ image, kind: "note", noteText });
                }}
              />
            )
          )}
          {draft && (
            <SendPreview
              draft={draft}
              onCancel={() => setDraft(null)}
              onDone={(ok, message) => {
                setLastResult({ ok, message });
                if (ok) setDraft(null);
              }}
            />
          )}
          {lastResult && (
            <p role="status" className={lastResult.ok ? "note-ok" : "note-held"}>
              {lastResult.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SendPreview({
  draft,
  onCancel,
  onDone,
}: {
  draft: Draft;
  onCancel: () => void;
  onDone: (ok: boolean, message: string) => void;
}) {
  const { group, sendPost } = useBooth();
  const [caption, setCaption] = useState("");
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);

  // Ask for caption ideas in the background. Slow or failed = no chips, nothing else changes.
  useEffect(() => {
    if (!group) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    fetch("/api/caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: draft.image,
        groupId: group.id,
        localTime: new Date().toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" }),
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d: { suggestions?: string[] }) => setSuggestions(Array.isArray(d.suggestions) ? d.suggestions : []))
      .catch(() => setSuggestions([]))
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft.image, group]);

  async function send() {
    setSending(true);
    try {
      const result = await sendPost({ image: draft.image, kind: draft.kind, caption, noteText: draft.noteText });
      onDone(result.status === "approved", result.status === "approved" ? "Sent! Your friends can scratch to reveal it." : result.message);
    } catch (e) {
      onDone(false, e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={draft.image} alt="Preview of your post" className="preview-photo" />
      <div className="field-row-stacked">
        <label htmlFor="caption">Caption (optional)</label>
        <input id="caption" type="text" maxLength={140} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>
      <div className="caption-chips" aria-live="polite">
        {suggestions === null && <span className="hint">Thinking of captions...</span>}
        {suggestions?.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => setCaption(s)} title="Use this caption (you can still edit it)">
            {s}
          </button>
        ))}
      </div>
      <div className="field-row">
        <button onClick={onCancel} disabled={sending}>
          {draft.kind === "note" ? "Back" : "Retake"}
        </button>
        <button className="pill-green" onClick={send} disabled={sending || !group}>
          {sending ? "Checking & sending..." : "Send to group"}
        </button>
      </div>
      {!group && <p>Join or create a group first (My Group icon).</p>}
    </div>
  );
}

function Tab({
  label,
  tone,
  selected,
  onSelect,
}: {
  label: string;
  tone: "green" | "pink" | "blue";
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li role="tab" aria-selected={selected} className={`tab-${tone}`}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onSelect();
        }}
      >
        {label}
      </a>
    </li>
  );
}
