import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

async function Account() {
  if (!hasSupabaseEnv) {
    return (
      <>
        <p>Sign-in is off: Supabase keys are missing from .env.local.</p>
        <Link href="/booth">
          <button>Open camera</button>
        </Link>
      </>
    );
  }
  // Render at request time: Supabase reads the clock to check session expiry,
  // which Next.js doesn't allow during prerendering.
  await connection();
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link href="/login">
        <button>Sign in</button>
      </Link>
    );
  }

  return (
    <>
      <p>
        Signed in as <b>{user.email}</b>
      </p>
      <Link href="/booth">
        <button>Open camera</button>
      </Link>
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}

export default function Home() {
  return (
    <div className="window">
      <div className="title-bar">
        <div className="title-bar-text">Study Booth</div>
      </div>
      <div className="window-body stack">
        <p>Study apart, together.</p>
        <Suspense fallback={<p>Loading...</p>}>
          <Account />
        </Suspense>
      </div>
    </div>
  );
}
