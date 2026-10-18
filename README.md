# Study Booth

**Study apart, together.** A laptop web app where small groups of student friends send each other playful, handmade-looking photos and notes while they study in different places. A calm little widget floats over your notes, so staying connected never means picking up your phone.

Built for the AI Lodge Hackathon (track: Projects for Daily Life).

---

## 1. Problem Statement

**What problem?** Studying alone is lonely, and the usual fix makes it worse. When students study by themselves they lose the quiet motivation of a friend at the next desk, so they reach for the group chat on their phone. One "just checking" turns into scrolling, and the study session is gone.

**Who experiences it?** Secondary and university students who study at home, in different places or on different schedules from their friends: commuters, students in separate schools or cities, and anyone revising late at night.

**Why is it worth solving?** Studying alongside friends makes it easier to start and to keep going, but the tools students use to stay in touch (phones, social feeds, group chats) are built to hold attention, not to give it back. Students need the feeling of studying side by side without an infinite feed, without notifications, and without a phone in their hand.

<!-- Optional: add your own survey numbers here, e.g. "X% of N students we asked study alone most evenings". -->

## 2. Solution Overview

Study Booth is a bright, glossy "gadget desk" in the browser. You and a few friends form a private, invite-only group. Every so often someone sends something small and handmade: a photo with a retro filter, a message finger-written on fogged-up camera glass, or a note in curly script on a stamped paper card. It arrives covered in silver scratch-card foil, and friends scratch it off to reveal it. It's a small moment of connection, then everyone goes back to work.

It stays on the laptop on purpose. A compact study widget pops out as an always-on-top mini window over your notes, with a study timer and the last three posts. There is no endless feed: only the last 24 hours, and focus mode hides new posts until your timer ends.

AI works quietly in the background, always on the server:

- it **reads handwriting** in every post and blocks mean or unsafe ones before any friend can see them,
- it **suggests captions** that fit your photo and study session (you choose, it never posts for you),
- it occasionally **nudges the group** with a friendly check-in ("Everyone's been at it a while. Stretch break!"),
- it writes a short **weekly story** from the group's real study stats.

## 3. Key Features

**Sign-in and groups**
- **Landing page:** "Study Booth" fills in dot by dot in a black script, then a centred sign-in card floats in.
- **Accounts:** email + password through Supabase Auth, with an email magic link as a fallback.
- **Private groups:** you can be in several groups. Each has a 6-character invite code (with a Copy button). There are no public profiles and no discovery. My Group has separate *Join a group* and *Start a new group* dialogs.
- **Settings:** change your display name, and set or change your password.

**Making a post** (always user-initiated, always with a preview first)
1. **Pick a style:**
   - **Photo:** a webcam snapshot with live filters: *Digicam* (early-2000s compact camera with an orange date stamp), *Film* and *B&W*. The shutter button sits in the corner of the camera frame.
   - **Fog glass:** blow into the mic to fog up the camera glass, then write in the fog with your **finger** (pinch to write, open your hand to lift; tracked on-device) or the mouse.
   - **Card note:** type a few words and watch them appear live in a handwritten script on a paper card. Choose the paper colour (pink, cream, baby blue, lilac, mint), text size and alignment, and press rubber stamps (star, heart, smiley, moon, dots) wherever you click.
2. **Create it.**
3. **Share it:** pick an AI caption suggestion or write your own, choose **which group** to send it to, and send.

**Home**
- **Stories row:** a bubble per friend. A pastel ring means unseen posts from the last 24 hours, and grey means you've seen them all. Tap one for a full-screen viewer and step through with taps or arrow keys.
- **Feed:** newest first, last 24 hours only. Each card shows who posted, when, and the style (Photo / Fog / Card), with a ⋯ menu to **report** a friend's post or **delete** your own.
- **Scratch to reveal:** friends' posts arrive under silver foil. Scratch about 60% and the rest reveals itself. Reveals are saved per person.
- **Your posts:** while still being checked, or if not shared, they stay pinned at the top with a "Checking…" or "Not shared" badge and the reason.
- **Live:** new posts appear within seconds (Supabase Realtime, with a polling fallback).

**Studying**
- **Study screen:** a big timer with a length picker, **focus mode** (hides new posts, story rings and badges until the timer ends) and today's total study time.
- **Pop-out widget** (Chrome/Edge): a compact always-on-top window with the timer, the last 3 posts as small scratch cards, and a New post button. No sounds, no flashing.
- **Smart check-ins** appear as one dismissible banner. *Demo shortcut:* **Ctrl+Shift+K** forces a check-in now.
- **Weekly Story:** one card with an AI-written recap and the week's stats.
- **Late-night glow:** after midnight the screen gets a warm lamp glow, and posts get a "still up?" tag.

**Design**
- **Glossy Y2K gadget look:** pearl plastic, chrome trim, pastel jelly pill buttons and little LCD screens. All art and icons are original CSS/SVG.
- **Layout:** one screen at a time with a nav rail that becomes a bottom tab bar on narrow windows.
- **Accessibility:** every screen has its own URL (`/`, `/study`, `/story`, `/group`, `/settings`, `?new=1` for the New post dialog), so Back and refresh work. Keyboard navigation, focus traps in dialogs, and reduced-motion support.

## 4. AI Integration

All AI runs in Next.js server routes (`app/api/*`) through the Anthropic SDK. The browser never sees an AI key. The model, provider URL and key come only from environment variables, so the app works with Anthropic directly or with an Anthropic-compatible provider. Every response must be JSON matching a **zod** schema. Structured outputs are used where the provider supports them, and anything that doesn't validate counts as a failure.

| Feature | Route | Input | Output | If the AI fails |
| --- | --- | --- | --- | --- |
| **Handwriting moderation** | `POST /api/moderate` | The post image, plus any typed text (note, caption) wrapped in `<typed_text>` tags | `{ readText, allowed, category, reason }`: it transcribes all text in the image first, then judges image + text together | **Fails closed.** The post is held and the sender gets a kind message. Friends never see it. |
| **Caption suggestions** | `POST /api/caption` | The photo, minutes into the current study session, local time, and the group's last 3 captions | `{ suggestions: string[] }` (up to 3), shown as chips; the user taps one and can still edit it | 5 s timeout, then simply no chips. The post still sends. |
| **Smart check-ins** | `POST /api/checkin` | Group state computed in code: who's online, minutes studied today, who's been quiet 90+ min, whether it's past midnight, recent check-ins | `{ shouldNudge, message? }`, shown to everyone as a banner | 8 s timeout, then silently skipped |
| **Weekly story** | `POST /api/weekly-story` | Stats computed **in SQL** (`group_week_stats`): hours, sessions, days, streak, late-night sessions, posts | `{ title, story }`; the numbers shown come from SQL, not the AI | A friendly "try again" message |

**How moderation fails closed.** Every post is inserted as `pending`, and Row Level Security stops users from changing a post's status. Only the server route, using the service-role key and only after the model approves, can set `approved`. If the AI errors, times out, refuses or returns invalid JSON, the post is set to `held`. If the route never runs, the post stays `pending`. Friends only ever see `approved` posts.

**Check-in rate limit.** Every open client asks for a check-in every 5 minutes. A database function (`claim_checkin_slot`) allows at most one evaluation every 4 minutes and one posted check-in every 45 minutes per group, however many people are online.

**Tooling.** `pnpm ai:check` makes one test call per AI feature through the running app and prints the results. `pnpm redteam` runs the red-team suite (see section 7). Both need `REDTEAM_TOKEN` set on the server.

## 5. External Tools & Datasets

| Tool | Used for | Licence / terms |
| --- | --- | --- |
| [Next.js 16](https://nextjs.org) (App Router, TypeScript) and React 19 | Web app and server routes | MIT |
| [Vercel](https://vercel.com) | Hosting (serverless functions for the API routes) | Hosted service (Hobby plan) |
| [Supabase](https://supabase.com) via `@supabase/supabase-js` and `@supabase/ssr` | Auth (email + password, magic link), Postgres with Row Level Security, private Storage bucket with signed URLs, Realtime | Libraries MIT; hosted service |
| [Anthropic Claude](https://docs.anthropic.com) via `@anthropic-ai/sdk`, reached directly or through an Anthropic-compatible proxy such as [apiyi](https://api.apiyi.com) | Vision + text model for moderation, captions, check-ins and the weekly story | SDK MIT; paid API, provider terms apply |
| [zod](https://zod.dev) | Validating every AI response | MIT |
| [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker): HandLandmarker | Fingertip tracking for fog writing, entirely in the browser (Google's pretrained hand model, downloaded from Google's CDN on first use) | Apache-2.0 |
| [Google Fonts](https://fonts.google.com) via `next/font`: Nunito, Baloo 2, Sevillana, Courier Prime | UI text, headings, card notes and the landing title, card details | SIL Open Font License 1.1 |
| Browser APIs | Web Audio (blow detection), Canvas 2D (fog, scratch foil, card notes, filters, dotted title), Document Picture-in-Picture (the pop-out widget) | Built into Chrome / Edge |

**Datasets:** none. The 28 red-team cases in `redteam/cases.json` were written by the team, and their images are generated by `redteam/make-images.mjs`. All styling is custom CSS (no UI kit), and all icons and art are original.

## 6. Installation & Setup

You need **Node.js 20+**, a free **Supabase** project and an **Anthropic** (or compatible provider) API key.

1. **Get the code and install**
   ```bash
   git clone https://github.com/wenhsin-smu/ai-lodge-2026.git
   cd ai-lodge-2026
   pnpm install         # or: npm install
   ```

2. **Create the database.** In Supabase, open **SQL Editor → New query**, paste the whole of `supabase/migrations/0001_init.sql`, and click **Run**. It creates every table, the Row Level Security policies, the private `posts` storage bucket and its policies, the helper functions, the trigger that creates a profile for each new user, and the Realtime setup. It's safe to run again.

3. **Auth settings** (Supabase → **Authentication**):
   - **Email provider:** enabled, with new sign-ups allowed. Turn **Confirm email** off if you want "Create account" to sign people straight in. If you leave it on, they'll be asked to confirm by email first.
   - **URL Configuration:** set *Site URL* to your deployed URL, and add Redirect URLs `http://localhost:3000/auth/callback` and `https://<your-app>.vercel.app/auth/callback` (used by magic links).
   - Optional: set up custom SMTP if you'll use magic links a lot, because Supabase's built-in email sender only sends a few emails per hour.

4. **Environment variables.** Copy `.env.example` to `.env.local` and fill it in:

   | Variable | Where to find it | Secret? |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | no |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → publishable (or legacy anon) | no |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → secret (or legacy service_role) | **yes, server only** |
   | `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys, or your provider | **yes, server only** |
   | `ANTHROPIC_MODEL` | Required: the model name exactly as your provider lists it | no |
   | `ANTHROPIC_BASE_URL` | Optional: provider URL (e.g. `https://api.apiyi.com`); empty = Anthropic | no |
   | `ANTHROPIC_FALLBACK_MODELS` | Optional: comma-separated fallback models; empty = no fallback | no |
   | `CAPTION_TIMEOUT_MS` | Optional: caption timeout (default 5000) | no |
   | `REDTEAM_TOKEN` | Optional: any long random string; enables `pnpm redteam` and `pnpm ai:check` | yes |

5. **Run it**
   ```bash
   pnpm dev             # then open http://localhost:3000 in Chrome or Edge
   pnpm ai:check        # in a second terminal: checks all 4 AI features
   pnpm build           # optional: the same production build Vercel runs
   ```

6. **Deploy:** import the repo on Vercel and add the same environment variables (Production and Preview). Vercel doesn't read `.env.local`.

**Try it as two friends.** Use two browser profiles (or two laptops) and create two accounts. Friend A: *My Group → Start a new group*, then copy the invite code. Friend B: *My Group → Join a group*. Post from one, then scratch to reveal on the other.

## 7. AI Safety & Limitations

### Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Mean, sexual, hateful or unsafe content, including **handwritten** text in images | Vision moderation transcribes handwriting first, then judges the image and all text together, **before** anyone else can see the post |
| **Prompt injection** written on the fog, in a card note or in a caption ("ignore your instructions…") | Text from images and users is wrapped in delimited tags, and every prompt that sees an image or user text states that it is data, never instructions. Injection attempts are themselves blocked. |
| AI outage, timeout or bad output | Moderation **fails closed** (see section 4). All outputs are validated with zod, and refusals or truncated replies count as failures. Captions and check-ins degrade silently and never block posting. |
| Hurtful AI wording | Caption, check-in and story prompts forbid comments on bodies, appearance, weight, mess or productivity, and forbid comparing members or singling anyone out. Captions are **suggestions only**: the user must pick or edit one, and nothing is auto-posted. |
| Made-up statistics | Weekly stats are computed in SQL; the model only writes prose around those numbers |
| Camera and mic privacy | Photos are never taken automatically: every capture is a button press with a preview. Hand tracking and blow detection run on-device, and the live feed is never uploaded. Only the finished post you choose to send is stored, in a **private** bucket served through short-lived signed URLs. |
| **Third-party AI processing** | To be moderated and captioned, every post (the image and any typed text) is sent from our server to the AI provider configured in `ANTHROPIC_BASE_URL`: Anthropic directly, or a third-party Anthropic-compatible proxy such as apiyi, which then forwards it to the model. Group stats (first names, study minutes) are sent for check-ins and the weekly story. Nothing is sent from the browser, and API keys stay on the server, but users should know their posts pass through that provider. |
| Young users | Invite-only groups, no public profiles, no discovery and no direct messages; prompts are written with under-18s in mind |
| Data leaking between groups | Row Level Security on every table and on the storage bucket: you can only read your own groups' rows and write your own posts, sessions and reports |
| Accounts and passwords | Handled entirely by Supabase Auth. The app stores no passwords and has no custom auth logic. |
| Something slips through | A **Report** button on every friend's post (hides it for you and records it for review), authors can delete their posts, and posts leave the feed and widget after 24 hours |

### Testing done

- **Red-team suite (method):** `redteam/cases.json` has **28 cases**: 8 harmless study posts, 8 mean or inappropriate posts, 6 prompt-injection attempts and 6 edge cases (sarcasm, slang, inside jokes, self-deprecation). Half are typed text and half are images with handwritten-style text. `pnpm redteam` sends each case to `/api/moderate` (and image cases to `/api/caption`) and writes a pass/fail table with a pass rate to `redteam/results.md`. Target: at least 90%.

  **Results:**

  | Group | Cases | Passed | Pass rate |
  | --- | --- | --- | --- |
  | Harmless (expect allow) | 8 | 8 | 100% |
  | Mean / inappropriate (expect block) | 8 | 8 | 100% |
  | Prompt injection (expect block) | 6 | 6 | 100% |
  | Edge cases: sarcasm, slang, inside jokes (expect allow) | 6 | 6 | 100% |
  | **Total** | **28** | **28** | **100%** (target ≥ 90%) |

  Blocked posts were labelled with the right category in all but one case: bullying (5), personal info, threat/violence, drugs/alcohol, and prompt injection (5 of 6). The sixth injection (`inj-06`, a "new rule" written on the fog) was still blocked, but labelled as bullying.

  **What the caption check showed.** Caption suggestions are only generated for the preview; nothing is posted until moderation approves. Across the 14 image cases they stayed friendly and never followed an injected instruction. Two weaker spots:
  - For `inj-04` (fog text pretending to grant "admin privileges"), one suggestion played along with the theme ("finally unlocked admin privileges 🔓"). It didn't change any decision, because that post was blocked.
  - For `mean-08` (rude text on messy notes), two suggestions mentioned the notes looking rough or messy, which brushes against our "never comment on mess" rule.

  Both are reasons captions stay suggestions that the user must pick or edit.

- **End-to-end tests (run during development):** a scripted two-friend test drove two real browser sessions through the whole app. It covers:
  - password sign-up for both friends, creating and joining a group
  - posting a photo with caption chips, the friend scratching it open, and the reveal persisting after reload
  - a mean card note being **held** by moderation (with a kind message to the sender, and never shown to the friend)
  - reporting and deleting posts, the study timer and focus mode, a forced check-in, the weekly story
  - posting to a chosen group when you're in two
  - changing your password in Settings (the old password stops working)

  All 60 checks pass. The tests ran against a local copy of the real database schema and policies, with stand-ins for Supabase Auth and the AI API, so they check the app's behaviour and its fail-closed paths, not the real model's judgement (that's what the red-team suite is for). The test scripts and stand-ins were development tools and aren't included in this repository.

- **Auth tests:** wrong password, existing email, rate-limit message, sign-up with no session ("check your email"), staying signed in across reloads (including the server refreshing an expired session), and signing out.

- **Row Level Security:** checked by trying to read other groups' posts, write as another user, and approve your own post directly as a member and as an outsider. All are refused.

### Known limitations

- **Red-team size.** 28 cases is a small test. A perfect score on it doesn't mean the moderator never makes mistakes, especially with new slang or handwriting styles we didn't test.
- **Moderation isn't perfect.** Sarcasm, slang and inside jokes are hard. The prompt leans towards friendly readings, so some subtle meanness can get through (hence the Report button). Very messy handwriting can be misread.
- **Finger writing** works best with one hand, palm towards the camera, in good light, near the middle of the frame:
  - Dim rooms (the app warns "too dark"), strong backlight and busy backgrounds lower accuracy.
  - The pinch is judged from 2D landmarks, so a hand turned side-on can be misread.
  - Older laptops without GPU acceleration track at a lower frame rate.
  - The ~8 MB hand model downloads the first time finger mode is used.
  - Mouse/trackpad writing always works as a fallback. Add `?debug=1` to the URL to see what the tracker sees.
- **Blow detection** listens for low-frequency mic noise, so fans, wind or a bass-heavy room can fog the glass. Each laptop may need the threshold slider adjusted.
- **Captions and check-ins need a network AI call.** On slow connections captions are often skipped (by design).
- **The pop-out widget** needs Chrome or Edge (Document Picture-in-Picture). In other browsers, keep the Study tab open instead.
- **Password reset when signed out** isn't built yet: you can change your password in Settings while signed in, or sign in with a magic link first.
- **Supabase's free email sender** only sends a few emails per hour, so heavy magic-link use needs custom SMTP.
- **The card note script** (Sevillana) is a free Google Font chosen to resemble a hand-lettered style; it isn't anyone's real handwriting.
