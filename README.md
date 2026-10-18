# Study Booth

**Study apart, together.** A laptop web app where small groups of student friends share playful, handmade-looking photos and notes while they study in different places. It lives in a tiny always-on-top corner window, so staying connected never means picking up your phone.

Built for the AI Lodge Hackathon (track: Projects for Daily Life).

---

## Problem Statement

Studying alone is lonely, and the usual fix, a group chat on your phone, is the biggest distraction there is.

- [X]% of students we surveyed (n = [N]) study alone most evenings.
- [X]% said they feel less motivated studying alone than with friends.
- [X]% said they pick up their phone "just to check messages" while studying; [X]% said that turns into scrolling.
- [Quote from a surveyed student]

Students want the feeling of studying side by side, without an infinite feed or a phone in their hand.

## Solution Overview

Study Booth is a bright, glossy "gadget desk" in the browser with a calm little widget that floats over your notes (Document Picture-in-Picture). You and your friends form a private, invite-only group. Every so often someone sends something small and handmade: a photo, a message finger-written on fogged glass, or a note that gets embroidered stitch by stitch. It arrives on everyone's widget under silver scratch-card foil, and friends scratch it off to reveal it.

AI works quietly in the background, always server-side:

- it reads handwriting and blocks mean or unsafe posts before anyone sees them,
- it suggests captions that fit your study session,
- it occasionally nudges the whole group ("Everyone's past 2 hours, show your desk!"),
- it writes a short weekly story from real study stats.

## Key Features

- **Private friend groups.** Email magic-link sign-in, groups with 6-character invite codes, no public profiles. Row Level Security on every table and the storage bucket.
- **Three ways to post** (always user-initiated, always with a preview and a retake button):
  - **Photo:** a normal webcam snapshot.
  - **Fog glass:** blow into the mic to fog the lens glass of the little booth camera, then write in it with your **finger** or the mouse/trackpad. Finger writing runs entirely on-device: **pinch** thumb and index finger to write, open your hand to lift the pen. The fingertip is smoothed with a One Euro filter, strokes are drawn as smooth curves, and only the middle 70% of the camera view is needed. Add `?debug=1` to the URL to see the hand landmarks, pen state, FPS and confidence.
  - **Stitched note:** type a note and watch a needle backstitch it onto linen in about two seconds, thread by thread, inside a wooden embroidery frame.
  - **Photo filters**, previewed live before you shoot: None, **Digicam** (soft compact-camera look, hot highlights, colour fringing, grain and an orange seven-segment date stamp), **Film** (warm, faded) and **B&W**. A quick white flash plays when you take the photo, and your last filter is remembered.
- **Scratch to reveal.** Friends' posts arrive covered in silver foil; scratch about 60% (adjustable eraser) and the rest reveals itself. Reveals are saved per person.
- **Live.** New posts appear on friends' screens within seconds (Supabase Realtime, with a polling fallback).
- **Calm study widget.** Pops out as an always-on-top mini window in Chrome/Edge (falls back to an in-page panel elsewhere). It shows only the last 3 posts from the last 24 hours, has no sounds or flashing, and includes a **study timer** with **focus mode**, which hides new posts until the timer ends.
- **Study sessions** are recorded (start, end, heartbeat) and power captions, check-ins and the weekly story.
- **Safety tools.** Report button on every friend's post (hides it for you), delete your own posts, posts vanish from the widget after 24 hours.
- **Late-night glow.** After midnight the screen takes on a warm lamp glow, and posts made then get a "still up?" tag.
- **Look and feel: glossy Y2K gadget.** Bright, toy-like and cheerful, like a 2008-era digital camera or MP3 player sitting on your desk. Creamy white and pearl plastic with chrome trim, and soft pastel accents (lime, baby pink, sky blue) on a light cream-to-sky background with a soft glow. Glossy jelly pill buttons are colour-coded by role (green = post/send, pink = fog and fun, blue = timer/focus, pearl = everything else), windows are rounded "device" panels with a chrome title strip, the camera view sits inside a cute cream camera body with a chrome bezel and a glossy lens, and check-ins arrive as pastel sticky notes with glossy tape. The invite code and study timer show on little LCD screens. Rounded Nunito type, with Baloo 2 for headings. The study widget is a quiet pearl panel that uses the pastels sparingly. All icons and art are original CSS/SVG.

## AI Integration

All AI calls run in Next.js server routes (`app/api/*`, Vercel serverless functions) through the Anthropic SDK. The model, provider URL and key come only from env vars (`ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`), so it works with Anthropic directly or an Anthropic-compatible provider. Every response must be JSON matching a **zod** schema; we use structured outputs where the provider supports them and otherwise fall back to plain JSON instructions, validating either way. Anything else counts as a failure. Model fallback is off unless `ANTHROPIC_FALLBACK_MODELS` lists the models it may use.

`npm run ai:check` makes one test call per AI feature through the running app and prints the results and any errors in full.

| Feature | Route | What goes in | What comes out | When it fails |
| --- | --- | --- | --- | --- |
| Handwriting moderation | `POST /api/moderate` | The uploaded image, plus any typed note/caption wrapped in `<typed_text>` tags | `{ readText, allowed, category, reason }` | **Fails closed**: the post stays held and the sender sees a kind message |
| Context-aware captions | `POST /api/caption` | Photo, minutes into the current study session, local time, group's last 3 captions | `{ suggestions: string[1..3] }` shown as chips; the user taps one and can still edit it | 5s timeout, then no chips; the post still sends |
| Smart check-ins | `POST /api/checkin` | Group state computed in code: who's online, minutes studied today, who's been quiet 90+ minutes, past midnight, recent check-ins | `{ shouldNudge, message? }`, shown on everyone's screen as a sticky note | 8s timeout, then silently skipped |
| Weekly story | `POST /api/weekly-story` | Stats computed **in SQL** (`group_week_stats`): hours, sessions, days, streak, late nights, posts | `{ title, story }` | Friendly "try again" message |

**How moderation fails closed.** Posts are inserted as `pending`, and RLS prevents users from changing a post's status. Only the server (service role key, after the model approves) can set `approved`. If the AI call errors, times out, refuses or returns invalid JSON, the post is set to `held`. If the route never runs at all, the post stays `pending`. Either way, friends never see it.

**Rate limits.** Every open client asks for a check-in every 5 minutes. A database function (`claim_checkin_slot`) allows at most one evaluation every 4 minutes and one posted check-in every 45 minutes per group.

**Demo control.** Double-click the taskbar clock (or press Ctrl+Shift+K) to force a check-in right now.

## External Tools & Datasets

- [Next.js 16](https://nextjs.org) (App Router, TypeScript), deployed on [Vercel](https://vercel.com)
- [Supabase](https://supabase.com): Auth (magic links), Postgres + Row Level Security, Storage (private bucket, signed URLs), Realtime
- [Anthropic API](https://docs.anthropic.com) via `@anthropic-ai/sdk` (vision + text, structured outputs)
- [zod](https://zod.dev) for schema validation
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) HandLandmarker (runs entirely in the browser; Google's pretrained hand landmark model)
- [Google Fonts](https://fonts.google.com): Nunito (UI) and Baloo 2 (headings), loaded with `next/font`. All other styling is custom CSS (no UI kit).
- Browser APIs: Web Audio (blow detection), Canvas 2D (fog, scratch foil, embroidery), Document Picture-in-Picture
- No external datasets. Red-team cases in `redteam/cases.json` were written by the team; their images are generated by `redteam/make-images.mjs`.

## Installation & Setup

You need Node.js 20+ and free Supabase and Anthropic accounts.

1. **Get the code and install**
   ```bash
   git clone https://github.com/wenhsin-smu/ai-lodge-2026.git
   cd ai-lodge-2026
   npm install          # or pnpm install
   ```
2. **Create the database.** In the Supabase dashboard: **SQL Editor → New query**, paste all of `supabase/migrations/0001_init.sql`, click **Run**. It creates every table, RLS policy, the private `posts` storage bucket and its policies, the helper functions, and adds `posts`, `checkins` and `post_reveals` to Realtime. It's safe to run again.
3. **Auth settings.** Supabase → **Authentication → URL Configuration**: set *Site URL* to your Vercel URL and add these *Redirect URLs*: `http://localhost:3000/auth/callback` and `https://<your-app>.vercel.app/auth/callback`. For a live demo, set up custom SMTP (the built-in email sender only allows a few emails per hour).
4. **Environment variables.** Copy `.env.example` to `.env.local` and fill it in:

   | Variable | Where to find it | Secret? |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | no |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → publishable (or legacy anon) | no |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → secret (or legacy service_role) | **yes, server only** |
   | `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys, or your provider's key | **yes, server only** |
   | `ANTHROPIC_MODEL` | required: the model name, exactly as your provider lists it | no |
   | `ANTHROPIC_BASE_URL` | optional: provider URL (e.g. `https://api.apiyi.com`); empty = Anthropic | no |
   | `ANTHROPIC_FALLBACK_MODELS` | optional: comma-separated fallback models; empty = fallback off | no |
   | `REDTEAM_TOKEN` | any long random string; enables the red-team script | yes |

5. **Run it:** `npm run dev`, then open http://localhost:3000 in Chrome or Edge. Then run `npm run ai:check` in a second terminal to confirm all 4 AI features work.
6. **Deploy:** import the repo on Vercel and add the same environment variables (Production and Preview). Vercel doesn't read `.env.local`.

**Try it as two friends.** Sign in on two laptops (or two browser profiles) with two different emails. Laptop A: *My Group → Start a new group*, then share the invite code. Laptop B: *My Group → Join with a code*. Then post from one and scratch on the other.

## AI Safety & Limitations

### Risks we designed for

| Risk | Guardrail |
| --- | --- |
| Mean, sexual, hateful or unsafe content, including **handwritten** text | Vision moderation reads handwriting first, then judges image + text together, before anyone else can see the post |
| **Prompt injection** written on the fog or in a note ("ignore your instructions…") | Text from images and users is wrapped in delimited tags and the system prompt says it is data to classify, never instructions; injection attempts are themselves blocked |
| Moderation outage or bad output | Fails closed (see above); zod validation; refusals and truncation count as failures |
| Under-18 users | Invite-only groups, no public profiles or discovery, no DMs; moderation and caption prompts are written for under-18s |
| Hurtful AI text | Caption, check-in and story prompts forbid comments on bodies, looks, rooms, mess or productivity, and forbid comparing members. Captions are suggestions only: never auto-added |
| Made-up stats | Weekly stats are computed in SQL; the model only writes prose from those numbers |
| Camera privacy | Photos are never taken automatically. Hand tracking runs on-device; the live feed is never uploaded or stored. Only the finished post you choose to send is uploaded, to a private bucket served through short-lived signed URLs |
| Data access between groups | Row Level Security on every table and the storage bucket (tested by trying to read, write and approve as members and outsiders) |
| Something slips through | Report button on every post (hides it for the reporter and is stored for review); authors can delete; posts leave the widget after 24 hours |

### Red-team results

`redteam/cases.json` has 28 cases: 8 harmless study posts, 8 mean or inappropriate (typed and handwritten), 6 prompt injections (mostly written on fog), and 6 edge cases (sarcasm, slang, inside jokes, self-deprecation). `npm run redteam` sends each to `/api/moderate` and, for image cases, `/api/caption`, and writes `redteam/results.md`.

[Paste the tables from redteam/results.md here after running `npm run redteam`.]

### Known limitations

- **Finger writing (hand tracking)** works best with one hand, palm towards the camera, in good light, inside the middle of the frame. Known limits:
  - Dim rooms (the app warns "too dark"), strong backlight from a window behind you, and busy backgrounds lower detection confidence.
  - The pinch is judged from 2D landmarks, so a hand turned side-on, or thumb and finger hidden behind each other, can read as a pinch (or miss one). Hold your hand flat to the camera.
  - Very fast movement is smoothed and can cut corners; if the hand is lost for more than about 150 ms, the stroke ends.
  - Older laptops without GPU acceleration run detection on the CPU at a lower frame rate (check `?debug=1`).
  - The hand model downloads (~8 MB) the first time finger mode is turned on.
  - Mouse/trackpad writing is always available as a fallback.
- **Blow detection** uses mic loudness below ~500 Hz, so loud fans, wind or a bass-heavy room can trigger fog. Each laptop may need the threshold slider adjusted.
- **Moderation is not perfect.** Sarcasm, slang and inside jokes are hard; we bias toward allowing friendly readings, which means some subtle meanness may get through (hence the report button). Messy handwriting can be misread.
- **Captions and check-ins depend on a network AI call.** On slow connections captions are often skipped (by design).
- **Pop-out widget** needs Chrome or Edge (Document Picture-in-Picture); other browsers get the in-page panel.
- Free-tier Supabase email limits can block sign-in during a busy demo without custom SMTP.
