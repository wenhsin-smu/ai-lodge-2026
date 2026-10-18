import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { BoothProvider } from "@/components/BoothProvider";
import AppShell from "@/components/AppShell";
import Monitor from "@/components/Monitor";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

// Shared by Home, Study, Weekly Story and My Group, so the data, the study
// timer and the pop-out widget survive moving between tabs.
async function Gate({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv) {
    return (
      <Monitor>
        <Welcome>
          <p>Supabase keys are missing from .env.local. See README.md → Installation &amp; Setup.</p>
        </Welcome>
      </Monitor>
    );
  }
  // Render at request time: Supabase reads the clock to check session expiry.
  await connection();
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Monitor>
        <Welcome>
          <p>Share playful, handmade photos and notes with your study friends while you each study at home.</p>
          <Link href="/login">
            <button className="pill-green">Sign in or sign up</button>
          </Link>
        </Welcome>
      </Monitor>
    );
  }

  return (
    <BoothProvider userId={user.id}>
      <AppShell email={user.email ?? ""}>{children}</AppShell>
    </BoothProvider>
  );
}

function Welcome({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-windows">
      <section className="window app-window">
        <div className="title-bar">
          <div className="title-bar-text">Welcome to Study Booth</div>
        </div>
        <div className="window-body stack">
          <p>
            <b>Study apart, together.</b>
          </p>
          {children}
        </div>
      </section>
    </div>
  );
}

export default function BoothLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Monitor>{null}</Monitor>}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
