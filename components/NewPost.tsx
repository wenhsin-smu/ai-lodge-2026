"use client";

import { useEffect, useState } from "react";
import FogBooth from "@/components/FogBooth";
import CardComposer from "@/components/CardComposer";
import { useBooth, type PostKind } from "@/components/BoothProvider";

type Style = "photo" | "fog" | "card";
type Draft = { image: string; kind: PostKind; noteText?: string };

const STYLES: { id: Style; label: string; blurb: string; tone: "green" | "pink" | "blue" }[] = [
  { id: "photo", label: "Photo", blurb: "A quick snap, with a filter", tone: "green" },
  { id: "fog", label: "Fog glass", blurb: "Blow to fog, then write on it", tone: "pink" },
  { id: "card", label: "Card note", blurb: "Your words, handwritten on a pretty card", tone: "blue" },
];

/** Style → create → preview & share. */
export default function NewPost({ onShared }: { onShared: (ok: boolean, message: string) => void }) {
  const [style, setStyle] = useState<Style | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);
  const step = !style ? 1 : draft ? 3 : 2;

  return (
    <div className="stack">
      <ol className="steps" aria-label="Steps">
        {["Style", "Create", "Share"].map((label, i) => (
          <li key={label} className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""} aria-current={step === i + 1 ? "step" : undefined}>
            <span>{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      {!style ? (
        <div className="style-picker" role="group" aria-label="Choose a style">
          {STYLES.map((s, i) => (
            <button key={s.id} className={`style-option pill-${s.tone}`} onClick={() => setStyle(s.id)} data-autofocus={i === 0 ? true : undefined}>
              <b>{s.label}</b>
              <span>{s.blurb}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {!draft && (
            <div className="field-row">
              <button className="small" onClick={() => setStyle(null)}>
                ← Styles
              </button>
              <b>{STYLES.find((s) => s.id === style)!.label}</b>
            </div>
          )}
          {/* Keyed by style so switching restarts the camera with or without the mic. */}
          {style === "card" ? (
            !draft && (
              <CardComposer
                onCreated={(image, noteText) => {
                  setLastResult(null);
                  setDraft({ image, kind: "note", noteText });
                }}
              />
            )
          ) : (
            <FogBooth
              key={style}
              fog={style === "fog"}
              hidden={Boolean(draft)}
              onCapture={(image, kind) => {
                setLastResult(null);
                setDraft({ image, kind });
              }}
            />
          )}
          {draft && (
            <SendPreview
              draft={draft}
              onCancel={() => setDraft(null)}
              onDone={onShared}
              onError={(message) => setLastResult({ ok: false, message })}
            />
          )}
          {lastResult && (
            <p role="status" className={lastResult.ok ? "note-ok" : "note-held"}>
              {lastResult.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SendPreview({
  draft,
  onCancel,
  onDone,
  onError,
}: {
  draft: Draft;
  onCancel: () => void;
  /** The post was saved (shared, or held by moderation). */
  onDone: (ok: boolean, message: string) => void;
  /** Nothing was saved; stay here so they can try again. */
  onError: (message: string) => void;
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
      const result = await sendPost({
        image: draft.image,
        kind: draft.kind,
        caption,
        noteText: draft.noteText,
      });
      onDone(result.status === "approved", result.status === "approved" ? "Sent! Your friends can scratch to reveal it." : result.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't send.");
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
      {!group && <p>Join or create a group first (My Group tab).</p>}
    </div>
  );
}
