# Bug Log

Bugs found during ClipCrafter development. Post-worthy ones get turned into dev.to posts.

---

## 2026-03-21 — Clerk user ID vs Supabase UUID mismatch in all API routes

**Symptom:** All API routes returned 403 Forbidden or 500 errors even when authenticated. `POST /api/projects/create` returned "Could not find the table 'public.projects' in the schema cache".

**Root cause:** Two separate issues compounded:
1. Supabase migration had never been run — tables didn't exist
2. All API routes were using Clerk's string user ID (`user_xxx`) directly as a UUID in `user_id` columns, which expect a Postgres UUID. Ownership checks like `project.user_id !== userId` always failed since one is a UUID and the other is a Clerk string

**Fix:**
- Ran `001_initial_schema.sql` migration via direct postgres connection
- Created `src/lib/user.ts` with `getSupabaseUserId()` helper — looks up (or auto-creates) the Supabase user record from a Clerk ID
- Updated all 5 API routes to call `getSupabaseUserId()` and compare UUIDs correctly

**Files:** `src/lib/user.ts`, all files under `src/app/api/projects/`

**Post-worthy:** Yes — "Clerk + Supabase: why you can't use Clerk's userId as a Supabase foreign key"

---

## 2026-03-21 — YouTube URL stored as project title, not as r2_key

**Symptom:** YouTube projects showed "failed" immediately. The `r2_key` column was empty even after creating a YouTube project.

**Root cause:** `UploadModal` was passing the YouTube URL as the project `title` field. The `processVideo` Inngest job reads `r2_key` to know what to download — it got `null` and failed silently.

**Fix:**
- `create` API route now accepts a separate `youtubeUrl` param and stores it in `r2_key`
- Modal passes `youtubeUrl` explicitly; title is derived cleanly from the video ID
- `processVideo` Step 1 detects if `r2Key` is a YouTube URL and branches to `yt-dlp` instead of S3 download

**Files:** `src/app/api/projects/create/route.ts`, `src/components/UploadModal.tsx`, `src/inngest/functions/process-video.ts`

**Post-worthy:** Yes — "Designing flexible source fields: how to support both file uploads and URL-based inputs in the same pipeline"

---

## 2026-03-21 — Inngest /api/inngest route blocked by Clerk middleware

**Symptom:** Inngest dev server could not register functions. `/api/inngest` returned 302 redirect to `/sign-in`. Functions list was empty.

**Root cause:** Clerk middleware had `isProtectedRoute` matching `/api(.*)` — which includes `/api/inngest`. The Inngest dev server makes unauthenticated GET/PUT requests to sync functions, so it got redirected to sign-in every time.

**Fix:** Added `isPublicApiRoute` matcher in `proxy.ts` to bypass Clerk auth for `/api/inngest` and `/api/webhooks` (webhooks are self-authenticating via Svix signatures).

**Files:** `src/proxy.ts`

**Post-worthy:** Yes — "Don't protect everything under /api — how to safely mix authenticated and public API routes in Next.js + Clerk"

---

## 2026-03-21 — Inngest SDK running in cloud mode locally (missing INNGEST_DEV=1)

**Symptom:** Even after unblocking `/api/inngest`, the route returned 500 with `"In cloud mode but no signing key found"`.

**Root cause:** The Inngest SDK defaults to "cloud mode" which requires `INNGEST_SIGNING_KEY`. For local dev you need `INNGEST_DEV=1` to tell the SDK it's talking to the local dev server (no signing key needed).

**Fix:** Added `INNGEST_DEV=1` to `.env.local`.

**Files:** `.env.local`

**Post-worthy:** Yes (bundle with Inngest middleware bug above into one post)

---

## 2026-03-21 — Inngest v4 SDK bug: triggers not included in function manifest

**Symptom:** Inngest dev server showed `triggers: []` for the `process-video` function. Events were received but the function never executed.

**Root cause:** Inngest SDK v4.0.2 has a regression where the `triggers` array is empty in the manifest sent during sync, even when `createFunction` correctly defines `{ event: "video/process" }`. The dev server sees the function but doesn't know which events to route to it.

**Fix:** Downgraded `inngest` from v4.0.2 to v3.52.7. Triggers now correctly appear in the manifest.

**Files:** `package.json`, `package-lock.json`

**Post-worthy:** Yes — "Inngest SDK v4 gotcha: empty triggers in dev server (and how to fix it)"

---

## 2026-03-21 — Inngest step isolation: temp file paths must be stable across steps

**Symptom:** Step 1 (download video) succeeded, but Step 2 (extract audio) failed with `ffmpeg: No such file or directory`. The file existed after Step 1 but was missing in Step 2.

**Root cause:** Inngest runs each step in a separate HTTP invocation (fresh execution context). Variables like `Date.now()` re-evaluate on every step call, so the temp file path generated in Step 1 was different from the path generated in Step 2. The file was downloaded to `/tmp/video-ABC.mp4` but Step 2 looked for `/tmp/video-XYZ.mp4`.

**Fix:** Changed temp file paths to use `projectId` (stable across all steps): `/tmp/clipcrafter-video-{projectId}.mp4`.

**Files:** `src/inngest/functions/process-video.ts`

**Post-worthy:** Yes — "The Inngest temp file trap: why your files disappear between steps"

---

## 2026-03-21 — Groq API key was a placeholder in .env.local

**Symptom:** Transcription step failed with "Invalid API Key".

**Root cause:** `.env.local` had `GROQ_API_KEY=placeholder_add_from_existing_env` — never replaced with the real key from the old prototype at `~/dev/toolnexus`.

**Fix:** Pulled real key from `~/dev/toolnexus/.env` and updated `.env.local`. Same for `GEMINI_API_KEY`.

**Files:** `.env.local`

**Post-worthy:** No (simple oversight)

---

## 2026-03-21 — Groq Whisper 25MB file size limit

**Symptom:** Transcription failed with `request_too_large` — audio file was 29MB.

**Root cause:** Groq Whisper API has a hard 25MB limit. A ~30min YouTube live stream easily exceeds this.

**Fix:** Added auto-compression in `transcribeAudio()` — if audio > 24MB, re-encodes with ffmpeg to 32kbps mono 16kHz (~14MB/hour) before sending. Original file untouched.

**Files:** `src/lib/groq.ts`

**Post-worthy:** Yes — "Groq Whisper's 25MB limit: how to auto-compress audio before transcription"

---

## 2026-03-21 — Gemini 1.5 Flash fully deprecated (404)

**Symptom:** Highlights generation failed with `404 Not Found — models/gemini-1.5-flash is not found`.

**Root cause:** `gemini-1.5-flash` is completely removed from the API. Gemini 3 is now available.

**Fix:** Updated fallback chain to: `gemini-2.5-flash → gemini-2.0-flash → gemini-flash-latest → gemini-2.0-flash-lite`. Added `GEMINI_MODEL` env override for future-proofing. Chain verified against live `/v1beta/models` API.

**Files:** `src/lib/gemini.ts`

**Post-worthy:** Yes (bundle with original Gemini deprecation post)

---

## 2026-03-21 — Groq free tier rate limit (7200 audio-seconds/hour)

**Symptom:** Transcription failed with rate limit exceeded after processing a live stream. Used 6342/7200 audio-seconds in one request.

**Root cause:** Groq free tier limits to 7200s (~2hrs) of audio per hour. A single long live stream nearly maxed it out.

**Fix:** Added `parseRetryAfterMs()` to surface the wait time in the error message. Inngest will retry after the window. Long-term: add duration check before processing, warn if > 30 min.

**Files:** `src/lib/groq.ts`

**Post-worthy:** No (rate limit issue, not a code bug)

---
