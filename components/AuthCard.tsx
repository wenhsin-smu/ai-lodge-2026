"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

const MIN_PASSWORD = 6;

type Busy = "" | "signin" | "signup" | "magic";

/** Turns Supabase auth errors into something friendly. */
function friendly(error: AuthError, action: "signin" | "signup" | "magic") {
  const code = error.code ?? "";
  const msg = error.message.toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return "That email and password don't match. Check them, or create an account.";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered"))
    return "There's already an account with this email. Sign in instead.";
  if (code === "weak_password" || msg.includes("at least 6"))
    return `Your password needs at least ${MIN_PASSWORD} characters.`;
  if (code === "email_not_confirmed") return "Please confirm your email first, or use a magic link instead.";
  if (code === "validation_failed" || msg.includes("invalid format") || msg.includes("is invalid"))
    return "That doesn't look like an email address.";
  if (code.includes("rate_limit") || error.status === 429) return "Too many tries. Wait a minute and try again.";
  if (action === "magic") return `Couldn't send the link: ${error.message}`;
  return `Something went wrong: ${error.message}`;
}

/** Email + password sign-in and sign-up, with a magic link as a fallback. */
export default function AuthCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // Refresh so the server renders with the new session cookie.
  const enter = () => {
    router.replace("/");
    router.refresh();
  };

  async function signIn(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email || !password) return setError("Enter your email and password.");
    setBusy("signin");
    setError("");
    const { error: err } = await createClient().auth.signInWithPassword({ email, password });
    if (err) {
      setError(friendly(err, "signin"));
      setBusy("");
    } else enter();
  }

  async function signUp() {
    if (!email) return setError("Enter your email first.");
    if (password.length < MIN_PASSWORD) return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    setBusy("signup");
    setError("");
    const { data, error: err } = await createClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    // With email confirmation off, an existing email can come back as a user with no identities.
    if (!err && data.user && data.user.identities?.length === 0) {
      setError("There's already an account with this email. Sign in instead.");
      setBusy("");
      return;
    }
    if (err) {
      setError(friendly(err, "signup"));
      setBusy("");
    } else if (data.session) enter();
    else {
      setBusy("");
      setError("Account created. Check your inbox to confirm your email, then sign in.");
    }
  }

  async function magicLink() {
    if (!email) return setError("Enter your email first, and we'll send you a link.");
    setBusy("magic");
    setError("");
    const { error: err } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy("");
    if (err) setError(friendly(err, "magic"));
    else setSent(true);
  }

  return (
    <section className="window auth-card">
      <div className="title-bar">
        <div className="title-bar-text">Sign in or create an account</div>
      </div>
      <div className="window-body">
        {sent ? (
          <div className="stack">
            <p>
              Check your inbox for a magic link from Study Booth. Opening it signs you in (and creates your account the first time).
            </p>
            <button className="small" onClick={() => setSent(false)}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={signIn} className="stack" noValidate>
            <div className="field-row-stacked">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field-row-stacked">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="hint">At least {MIN_PASSWORD} characters.</span>
            </div>
            <div className="auth-actions">
              <button className="pill-green" type="submit" disabled={Boolean(busy)}>
                {busy === "signin" ? "Signing in..." : "Sign in"}
              </button>
              <button className="pill-blue" type="button" onClick={signUp} disabled={Boolean(busy)}>
                {busy === "signup" ? "Creating..." : "Create account"}
              </button>
            </div>
            {error && (
              <p role="alert" className="note-held">
                {error}
              </p>
            )}
            <button className="small login-magic" type="button" onClick={magicLink} disabled={Boolean(busy)}>
              {busy === "magic" ? "Sending..." : "Email me a magic link instead"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
