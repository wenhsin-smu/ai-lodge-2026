"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBooth } from "@/components/BoothProvider";
import { formatLeft, usePip, useSessionLeft } from "@/components/Widget";

const LENGTHS = [25, 50, 90, 120];

export default function StudyScreen() {
  const { group, session, startStudy, stopStudy, setFocus } = useBooth();
  const left = useSessionLeft();
  const [minutes, setMinutes] = useState(50);
  const [focus, setFocusChoice] = useState(false);
  const [error, setError] = useState("");

  if (!group) {
    return (
      <section className="window card">
        <div className="window-body stack">
          <h2>Study</h2>
          <p>Join or start a group first, so your friends can study alongside you.</p>
          <Link href="/group" className="pill-link pill-green">
            Go to My Group
          </Link>
        </div>
      </section>
    );
  }

  const running = session && left !== null;

  return (
    <div className="stack">
      <section className="window card">
        <div className="window-body stack study-card">
          <h2>{running ? "Studying" : "Study timer"}</h2>
          <div className="timer-readout timer-big" aria-live="off">
            {running ? formatLeft(left) : `${minutes}:00`}
          </div>

          {!running && (
            <div className="field-row">
              <span>Length</span>
              <div className="filter-chips" role="radiogroup" aria-label="Timer length">
                {LENGTHS.map((m) => (
                  <button key={m} role="radio" aria-checked={minutes === m} className={minutes === m ? "small pill-blue" : "small"} onClick={() => setMinutes(m)}>
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field-row">
            {running ? (
              <>
                <input id="focus-live" type="checkbox" checked={session.focus} onChange={(e) => setFocus(e.target.checked)} />
                <label htmlFor="focus-live">Focus mode (hide new posts, rings and badges)</label>
              </>
            ) : (
              <>
                <input id="focus-choice" type="checkbox" checked={focus} onChange={(e) => setFocusChoice(e.target.checked)} />
                <label htmlFor="focus-choice">Focus mode (hide new posts, rings and badges until the timer ends)</label>
              </>
            )}
          </div>

          {running ? (
            <button className="pill-blue" onClick={() => void stopStudy()}>
              Stop
            </button>
          ) : (
            <button
              className="pill-blue"
              onClick={() => {
                setError("");
                startStudy(minutes, focus).catch((e: Error) => setError(e.message));
              }}
            >
              Start studying
            </button>
          )}
          {error && <p className="hint">{error}</p>}
          <TodayTotal />
        </div>
      </section>

      <WidgetCard />
    </div>
  );
}

/** Minutes studied since midnight, from your study sessions. */
function TodayTotal() {
  const { supabase, me, session } = useBooth();
  const [past, setPast] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!me) return;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    let live = true;
    void supabase
      .from("study_sessions")
      .select("id, started_at, ended_at, last_seen_at")
      .eq("user_id", me.id)
      .gte("started_at", midnight.toISOString())
      .then(({ data }) => {
        if (!live) return;
        let ms = 0;
        for (const s of data ?? []) {
          if (s.id === session?.id) continue; // the running one is counted live below
          const end = s.ended_at ?? s.last_seen_at ?? s.started_at;
          ms += Math.max(0, new Date(end as string).getTime() - new Date(s.started_at as string).getTime());
        }
        setPast(ms);
      });
    return () => {
      live = false;
    };
  }, [supabase, me, session]);

  useEffect(() => {
    if (!session) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [session]);

  if (past === null) return null;
  const total = past + (session ? Math.max(0, now - session.startedAt) : 0);
  const mins = Math.round(total / 60_000);
  return (
    <p className="today-total">
      Today: <b>{mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}</b> studied
    </p>
  );
}

function WidgetCard() {
  const { supported, isOpen, open } = usePip();
  return (
    <section className="window card">
      <div className="window-body stack">
        <h3>Study widget</h3>
        <p className="hint">
          {supported
            ? "A small window that floats over your notes with your timer and the latest posts, so you never need to switch tabs."
            : "Pop-out needs Chrome or Edge. Keep this tab open beside your notes instead."}
        </p>
        {supported && (
          <div className="field-row">
            <button className="pill-blue" onClick={() => void open()}>
              {isOpen ? "Widget is popped out" : "Pop out widget"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
