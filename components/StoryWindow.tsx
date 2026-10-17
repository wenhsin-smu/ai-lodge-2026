"use client";

import { useState } from "react";
import { useBooth } from "@/components/BoothProvider";

type Stats = Record<string, number>;

const LABELS: [string, string][] = [
  ["total_hours", "hours studied"],
  ["study_sessions", "study sessions"],
  ["days_studied", "days with studying"],
  ["longest_streak_days", "day streak"],
  ["late_night_sessions", "late-night sessions"],
  ["posts", "posts shared"],
];

export default function StoryWindow() {
  const { group } = useBooth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title?: string; story?: string; stats?: Stats; error?: string } | null>(null);

  async function generate() {
    if (!group) return;
    setLoading(true);
    try {
      const res = await fetch("/api/weekly-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      setResult(await res.json());
    } catch {
      setResult({ error: "Couldn't reach the story writer." });
    } finally {
      setLoading(false);
    }
  }

  if (!group) return <p>Join a group to get a weekly story.</p>;

  return (
    <div className="stack">
      <button className="pill-pink" onClick={generate} disabled={loading}>
        {loading ? "Writing your story..." : "Generate this week's story"}
      </button>
      {result?.error && <p className="hint">{result.error}</p>}
      {result?.story && (
        <div className="story-paper">
          <h3>{result.title}</h3>
          {result.story.split(/\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}
      {result?.stats && (
        <ul className="stat-row">
          {LABELS.map(([key, label]) => (
            <li key={key}>
              <b>{result.stats![key] ?? 0}</b> {label}
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Only your group can see this. Numbers come straight from the database; the AI only writes the words.</p>
    </div>
  );
}
