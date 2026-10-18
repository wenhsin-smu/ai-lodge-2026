import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { BoothProvider } from "@/components/BoothProvider";
import AppShell from "@/components/AppShell";
import Landing from "@/components/Landing";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

// Shared by Home, Study, Weekly Story and My Group, so the data, the study
// timer and the pop-out widget survive moving between tabs.
async function Gate({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv) {
    return (
      <Landing
        notice={
          <section className="window auth-card">
            <div className="window-body">
              <p>Supabase keys are missing from .env.local. See README.md → Installation &amp; Setup.</p>
            </div>
          </section>
        }
      />
    );
  }
  // Render at request time: Supabase reads the clock to check session expiry.
  await connection();
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <Landing />;

  return (
    <BoothProvider userId={user.id}>
      <AppShell email={user.email ?? ""}>{children}</AppShell>
    </BoothProvider>
  );
}

export default function BoothLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
