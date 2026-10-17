"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import GroupWindow from "@/components/GroupWindow";
import NewPost from "@/components/NewPost";
import PostList from "@/components/PostList";
import StoryWindow from "@/components/StoryWindow";
import WidgetLauncher from "@/components/Widget";
import { CameraIcon, GroupIcon, PostsIcon, StoryIcon, WidgetIcon } from "@/components/Icons";
import { useBooth } from "@/components/BoothProvider";
import Monitor from "@/components/Monitor";

type WindowId = "newpost" | "posts" | "group" | "story" | "widget";

const CHECKIN_EVERY_MS = 5 * 60_000;

export default function Desktop({ email }: { email: string }) {
  const { group, loading, error, checkins, me, refresh } = useBooth();
  const [chosen, setOpen] = useState<WindowId[] | null>(null);
  // First visit: the group window until you're in a group, then the posts + widget.
  const open = chosen ?? (loading ? [] : group ? (["widget", "posts"] as WindowId[]) : (["group"] as WindowId[]));
  const [eraserSize, setEraserSize] = useState(28);
  const [previewAsFriend, setPreviewAsFriend] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [demoStatus, setDemoStatus] = useState("");

  const toggle = (id: WindowId) => setOpen(open.includes(id) ? open.filter((w) => w !== id) : [id, ...open]);
  const show = (id: WindowId) => setOpen([id, ...open.filter((w) => w !== id)]);

  // Smart check-ins: every open client asks every 5 minutes; the server rate-limits.
  const askForCheckin = useCallback(
    async (force = false) => {
      if (!group) return;
      const now = new Date();
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          localTime: now.toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" }),
          localHour: now.getHours(),
          force,
        }),
      }).catch(() => null);
      const result = res ? ((await res.json().catch(() => ({}))) as { shouldNudge?: boolean; reason?: string }) : null;
      if (result?.shouldNudge) await refresh();
      return result;
    },
    [group, refresh],
  );

  useEffect(() => {
    if (!group) return;
    const first = window.setTimeout(() => void askForCheckin(), 20_000);
    const every = window.setInterval(() => void askForCheckin(), CHECKIN_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [group, askForCheckin]);

  // Hidden demo control: double-click the clock (or Ctrl+Shift+K) to force a check-in now.
  const forceCheckin = useCallback(async () => {
    setDemoStatus("…");
    const r = await askForCheckin(true);
    setDemoStatus(r?.shouldNudge ? "" : (r?.reason ?? "no check-in"));
    window.setTimeout(() => setDemoStatus(""), 4000);
  }, [askForCheckin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k") void forceCheckin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forceCheckin]);

  const notes = checkins.filter((c) => !dismissed.has(c.id)).slice(0, 2);

  const windows: Record<WindowId, { title: string; body: React.ReactNode; wide?: boolean }> = {
    newpost: { title: "New post", body: <NewPost />, wide: true },
    posts: {
      title: "Friends' Posts (last 24 hours)",
      body: (
        <div className="stack">
          <div className="field-row">
            <label htmlFor="eraser">Eraser size</label>
            <input id="eraser" type="range" min={10} max={60} value={eraserSize} onChange={(e) => setEraserSize(Number(e.target.value))} />
          </div>
          <div className="field-row">
            <input id="preview-friend" type="checkbox" checked={previewAsFriend} onChange={(e) => setPreviewAsFriend(e.target.checked)} />
            <label htmlFor="preview-friend">Preview my posts as a friend sees them</label>
          </div>
          <PostList eraserSize={eraserSize} previewAsFriend={previewAsFriend} />
        </div>
      ),
    },
    group: { title: "My Group", body: <GroupWindow onJoined={() => setOpen(["group", "widget", "posts"])} /> },
    story: { title: "Weekly Story", body: <StoryWindow /> },
    widget: { title: "Study widget", body: <WidgetLauncher onNewPost={() => show("newpost")} /> },
  };

  return (
    <Monitor
      notes={notes.map((n) => (
        <div key={n.id} className="sticky-note">
          <button className="sticky-close" aria-label="Dismiss note" onClick={() => setDismissed((s) => new Set(s).add(n.id))}>
            ×
          </button>
          {n.message}
        </div>
      ))}
      taskbar={
        <>
          <span className="taskbar-user">
            {me?.display_name ?? email}
            {group ? ` · ${group.name}` : ""}
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="small">
              Sign out
            </button>
          </form>
          <Clock onDoubleClick={() => void forceCheckin()} status={demoStatus} />
        </>
      }
    >
      <nav className="desktop-icons" aria-label="Desktop">
        <DesktopIcon label="New Post" icon={<CameraIcon />} onOpen={() => show("newpost")} />
        <DesktopIcon label="Friends' Posts" icon={<PostsIcon />} onOpen={() => toggle("posts")} />
        <DesktopIcon label="My Group" icon={<GroupIcon />} onOpen={() => toggle("group")} />
        <DesktopIcon label="Weekly Story" icon={<StoryIcon />} onOpen={() => toggle("story")} />
        <DesktopIcon label="Study Widget" icon={<WidgetIcon />} onOpen={() => toggle("widget")} />
      </nav>
      <div className="desktop-windows">
        {error && (
          <div className="window">
            <div className="title-bar">
              <div className="title-bar-text">Setup needed</div>
            </div>
            <div className="window-body">
              <p>{error}</p>
            </div>
          </div>
        )}
        {loading && <p className="desktop-loading">Loading your booth…</p>}
        {!loading &&
          open.map((id) => (
            <section key={id} className={`window app-window${windows[id].wide ? " wide" : ""}`}>
              <div className="title-bar">
                <div className="title-bar-text">{windows[id].title}</div>
                <div className="title-bar-controls">
                  <button aria-label="Close" onClick={() => toggle(id)} />
                </div>
              </div>
              <div className="window-body">{windows[id].body}</div>
            </section>
          ))}
      </div>
    </Monitor>
  );
}

function DesktopIcon({ label, icon, onOpen }: { label: string; icon: React.ReactNode; onOpen: () => void }) {
  return (
    <button className="desktop-icon" onClick={onOpen} onDoubleClick={onOpen}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

const subscribeMinute = (onChange: () => void) => {
  const t = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(t);
};
const readClock = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Clock({ onDoubleClick, status }: { onDoubleClick: () => void; status: string }) {
  const time = useSyncExternalStore(subscribeMinute, readClock, () => "");
  return (
    <span className="taskbar-clock" onDoubleClick={onDoubleClick}>
      {status || time}
    </span>
  );
}
