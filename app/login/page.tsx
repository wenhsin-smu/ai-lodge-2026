"use client";

import { useState } from "react";
import Monitor from "@/components/Monitor";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <Monitor>
      <div className="desktop-windows">
        <section className="window app-window">
          <div className="title-bar">
            <div className="title-bar-text">Sign in or sign up</div>
          </div>
          <div className="window-body">
            {status === "sent" ? (
              <p>
                Check your inbox for a magic link from Study Booth. Opening it
                signs you in (and creates your account the first time).
              </p>
            ) : (
              <form onSubmit={onSubmit} className="stack">
                <div className="field-row-stacked">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button className="pill-green" type="submit" disabled={status === "sending"}>
                  {status === "sending" ? "Sending..." : "Send magic link"}
                </button>
                {status === "error" && (
                  <p role="alert">Couldn&apos;t send the link: {error}</p>
                )}
              </form>
            )}
          </div>
        </section>
      </div>
    </Monitor>
  );
}
