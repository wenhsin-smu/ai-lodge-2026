"use client";

import { useState } from "react";
import { useBooth } from "@/components/BoothProvider";

/** Supabase's default minimum password length. */
const MIN_PASSWORD = 6;

export default function SettingsScreen() {
  return (
    <div className="stack">
      <section className="window card">
        <div className="window-body stack">
          <h2>Settings</h2>
          <NameSettings />
        </div>
      </section>
      <section className="window card">
        <div className="window-body stack">
          <PasswordSettings />
        </div>
      </section>
    </div>
  );
}

function NameSettings() {
  const { me, renameMe } = useBooth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          await renameMe(name);
          setName("");
          setMessage({ ok: true, text: "Name saved." });
        } catch (err) {
          setMessage({ ok: false, text: err instanceof Error ? err.message : "Couldn't save your name." });
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Your name</h3>
      <p className="hint">This is what friends see on your posts and in the group.</p>
      <div className="field-row">
        <input
          aria-label="Display name"
          value={name}
          maxLength={30}
          placeholder={me?.display_name ?? ""}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="pill-green" type="submit" disabled={busy || !name.trim()}>
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
      {message && (
        <p role="status" className={message.ok ? "note-ok" : "note-held"}>
          {message.text}
        </p>
      )}
    </form>
  );
}

/** Sets a new password with Supabase Auth (also gives magic-link accounts a password). */
function PasswordSettings() {
  const { supabase } = useBooth();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < MIN_PASSWORD) return setMessage({ ok: false, text: `Your password needs at least ${MIN_PASSWORD} characters.` });
        if (password !== again) return setMessage({ ok: false, text: "The two passwords don't match." });
        setBusy(true);
        setMessage(null);
        const { error } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (error) {
          const rate = error.code?.includes("rate_limit") || error.status === 429;
          setMessage({ ok: false, text: rate ? "Too many attempts, wait a minute." : error.message });
        } else {
          setPassword("");
          setAgain("");
          setMessage({ ok: true, text: "Password updated. Use it next time you sign in." });
        }
      }}
    >
      <h3>Change password</h3>
      <p className="hint">Signed up with a magic link? Set a password here to sign in with it next time.</p>
      <div className="field-row-stacked">
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="field-row-stacked">
        <label htmlFor="new-password-again">Type it again</label>
        <input id="new-password-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        <span className="hint">At least {MIN_PASSWORD} characters.</span>
      </div>
      <div className="field-row">
        <button className="pill-blue" type="submit" disabled={busy || !password}>
          {busy ? "Updating..." : "Update password"}
        </button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "note-ok" : "note-held"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
