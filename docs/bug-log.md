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
