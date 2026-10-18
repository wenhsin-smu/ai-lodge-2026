"use client";

// One screen at a time: a slim nav rail (a bottom tab bar on narrow windows),
// a top bar with the study timer chip and avatar menu, a check-in banner, and
// the current screen in a centred column. The New post modal is `?new=1`.

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import NewPost from "@/components/NewPost";
import { GroupIcon, HomeIcon, PlusIcon, StoryIcon, WidgetIcon } from "@/components/Icons";
import { useBooth } from "@/components/BoothProvider";
import { PipProvider, formatLeft, useSessionLeft } from "@/components/Widget";
import { Avatar, Modal } from "@/components/ui";

const CHECKIN_EVERY_MS = 5 * 60_000;

type Shell = {
  /** Opens the New post modal over the current screen. */
  openNewPost: () => void;
  /** A one-line status shown under the top bar (e.g. after sharing). */
  flash: (message: string, ok: boolean) => void;
};
const ShellContext = createContext<Shell>({ openNewPost: () => {}, flash: () => {} });
export const useShell = () => useContext(ShellContext);

const TABS = [
  { href: "/", label: "Home", icon: <HomeIcon size={30} /> },
  { href: "?new=1", label: "New post", icon: <PlusIcon size={30} /> },
  { href: "/study", label: "Study", icon: <WidgetIcon size={30} /> },
  { href: "/story", label: "Weekly Story", icon: <StoryIcon size={30} /> },
  { href: "/group", label: "My Group", icon: <GroupIcon size={30} /> },
];

export default function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <PipProvider>
      <Shell email={email}>{children}</Shell>
    </PipProvider>
  );
}

function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const newOpen = params.get("new") === "1";
  const { group, loading, error, checkins, refresh } = useBooth();
  const openedInApp = useRef(false);
  const [notice, setNotice] = useState<{ message: string; ok: boolean } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [demoStatus, setDemoStatus] = useState("");

  const openNewPost = useCallback(() => {
    openedInApp.current = true;
    router.push(`${pathname}?new=1`);
  }, [router, pathname]);

  const closeNewPost = useCallback(() => {
    if (openedInApp.current) router.back();
    else router.replace(pathname);
    openedInApp.current = false;
  }, [router, pathname]);

  const flash = useCallback((message: string, ok: boolean) => {
    setNotice({ message, ok });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

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

  // Hidden demo control: Ctrl+Shift+K forces a check-in now.
  const forceCheckin = useCallback(async () => {
    setDemoStatus("Asking for a check-in…");
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

  const lateNight = useSyncExternalStore(subscribeMinute, isLateNight, () => false);
  const checkin = checkins.find((c) => !dismissed.has(c.id));

  return (
    <ShellContext.Provider value={{ openNewPost, flash }}>
      <div className={lateNight ? "app late-night" : "app"}>
        <nav className="nav-rail" aria-label="Main">
          {TABS.map((t) => {
            const isNew = t.href === "?new=1";
            const active = isNew ? newOpen : !newOpen && pathname === t.href;
            return (
              <Link
                key={t.href}
                href={isNew ? `${pathname}?new=1` : t.href}
                className={active ? "nav-item active" : "nav-item"}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (isNew) openedInApp.current = true;
                }}
                onKeyDown={moveFocusWithArrows}
              >
                {t.icon}
                <span>{t.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-main">
          <header className="top-bar">
            <Link href="/" className="brand">
              <span className="brand-dot" aria-hidden="true" />
              Study Booth
            </Link>
            {lateNight && <span className="late-night-tag">still up? 🌙</span>}
            <div className="top-bar-right">
              <TimerChip />
              <AvatarMenu email={email} />
            </div>
          </header>

          {(checkin || demoStatus) && (
            <div className="checkin-banner" role="status">
              <span>{checkin && !demoStatus ? checkin.message : demoStatus}</span>
              {checkin && !demoStatus && (
                <button className="small" aria-label="Dismiss check-in" onClick={() => setDismissed((s) => new Set(s).add(checkin.id))}>
                  ×
                </button>
              )}
            </div>
          )}
          {notice && (
            <p role="status" className={notice.ok ? "note-ok app-notice" : "note-held app-notice"}>
              {notice.message}
            </p>
          )}

          <main className="app-column">
            {error ? (
              <section className="window card">
                <div className="window-body stack">
                  <h2>Setup needed</h2>
                  <p>{error}</p>
                </div>
              </section>
            ) : loading ? (
              <p className="desktop-loading">Loading your booth…</p>
            ) : (
              children
            )}
          </main>
        </div>

        {newOpen && !loading && (
          <Modal title="New post" onClose={closeNewPost} className="modal-wide">
            <NewPost
              onShared={(ok, message) => {
                openedInApp.current = false;
                router.replace("/");
                flash(message, ok);
              }}
            />
          </Modal>
        )}
      </div>
    </ShellContext.Provider>
  );
}

/** Up/Down (rail) and Left/Right (tab bar) move between tabs. */
function moveFocusWithArrows(e: React.KeyboardEvent<HTMLAnchorElement>) {
  const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  const items = Array.from(e.currentTarget.parentElement!.querySelectorAll<HTMLElement>(".nav-item"));
  const i = items.indexOf(e.currentTarget);
  e.preventDefault();
  items[(i + step + items.length) % items.length].focus();
}

function TimerChip() {
  const { loading } = useBooth();
  // The session is restored from this browser, so wait until after hydration to show it.
  const live = useSessionLeft();
  const left = loading ? null : live;
  return (
    <Link href="/study" className="timer-chip" aria-label={left === null ? "Study timer" : `Study timer, ${formatLeft(left)} left`}>
      ⏱ {left === null ? "Study" : formatLeft(left)}
    </Link>
  );
}

function AvatarMenu({ email }: { email: string }) {
  const { me, group } = useBooth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = me?.display_name ?? email;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="avatar-menu" ref={ref}>
      <button className="avatar-button" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${name}`} onClick={() => setOpen((o) => !o)}>
        <Avatar id={me?.id ?? email} name={name} size={34} />
      </button>
      {open && (
        <div className="popover avatar-popover" role="menu">
          <div className="popover-head">
            <b>{name}</b>
            <span className="hint">{group ? group.name : email}</span>
          </div>
          <Link href="/group" role="menuitem" className="popover-link" onClick={() => setOpen(false)}>
            Group &amp; name
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className="small">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const subscribeMinute = (onChange: () => void) => {
  const t = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(t);
};
const isLateNight = () => new Date().getHours() < 4;
