# ClipCrafter — Architecture & Third-Party Services

## Overview

ClipCrafter is a full-stack AI video tools platform. Videos are ingested (upload or YouTube URL), processed through a background pipeline (transcription → highlights → captions), and made available for clipping and export.

```
User Browser
    │
    ▼
[Vercel] Next.js 16.2 (App Router)
    │  API routes + UI
    │
    ├──► [Clerk]         Auth (sign-in, sessions, user management)
    ├──► [Supabase]      Postgres DB (projects, clips, transcripts)
    ├──► [Cloudflare R2] Object storage (video, audio, exports, cookies)
    ├──► [Inngest Cloud] Background job orchestration
    │
    └──► triggers Inngest event
              │
              ▼
        [Railway Worker] Next.js (same codebase, runs background jobs)
              │
              ├──► [yt-dlp]        YouTube video download
              ├──► [ffmpeg]        Audio extraction (MP3)
              ├──► [Sarvam]        Transcription (primary, Indian languages)
              ├──► [Modal]         Transcription fallback (faster-whisper)
              ├──► [Groq]          Transcription last fallback
              ├──► [Gemini]        Highlights + captions generation
              └──► [Remotion]      Caption video rendering
```

---

## Services

### 🔐 Authentication — Clerk
- **URL:** https://clerk.com
- **Dashboard:** https://dashboard.clerk.com
- **Docs:** https://clerk.com/docs
- **Plan:** Development (free)
- **Instance:** Dev instance (pk_test_...)
- **Used for:** Sign-in, sign-up, session management, user identity
- **Env vars:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Notes:**
  - Client Trust: OFF (no OTP on new devices)
  - Use `sign_in_tokens` API for passwordless admin access
  - Clerk `user_xxx` ID ≠ Supabase UUID — always use `getSupabaseUserId()` helper

---

### 🗄️ Database — Supabase (Postgres)
- **URL:** https://supabase.com
- **Dashboard:** https://app.supabase.com/project/qrpcxesqhtuustwyakcd
- **Docs:** https://supabase.com/docs
- **Plan:** Free tier
- **Project ref:** `qrpcxesqhtuustwyakcd`
- **Used for:** All persistent data — projects, clips, transcripts, highlights, user mappings
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Notes:**
  - RLS enabled on all tables
  - Migrations in `supabase/migrations/`
  - Service role key used server-side only (Inngest functions, API routes)

---

### 📦 Object Storage — Cloudflare R2
- **URL:** https://dash.cloudflare.com
- **Docs:** https://developers.cloudflare.com/r2/
- **Plan:** Free tier (10 GB storage, 1M Class A ops/month)
- **Bucket:** `toolnexus-videos`
- **Account ID:** `9545addada6df4417aaff660e546d7f6`
- **Endpoint:** `https://9545addada6df4417aaff660e546d7f6.r2.cloudflarestorage.com`
- **Used for:** Video uploads, extracted audio (MP3), exported clips, yt-dlp cookies (`config/yt-cookies.txt`)
- **Env vars:** `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`
- **SDK:** `@aws-sdk/client-s3` (S3-compatible API)
- **Notes:**
  - Presigned URLs for uploads (from browser) and downloads (7-day TTL for exports)
  - R2 client is lazy-initialized (created on first use, not at module load) to avoid credential errors
  - No egress fees (unlike S3)

---

### ⚙️ Background Jobs — Inngest
- **URL:** https://app.inngest.com
- **Docs:** https://www.inngest.com/docs
- **Plan:** Free tier
- **Org:** ClipCrafter (`clipcrafterapp@gmail.com`)
- **App endpoint (Vercel):** `https://toolnexus-app.vercel.app/api/inngest`
- **App endpoint (Railway):** `https://clipcrafter-app-production.up.railway.app/api/inngest`
- **Used for:** Orchestrating the full video processing pipeline
- **Env vars:** `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`
- **SDK version:** `inngest@3.52.7` (stay on v3 — v4 has trigger manifest bug)
- **Functions (3):**
  - `toolnexus/process-video` — main pipeline (download → transcribe → highlights)
  - `toolnexus/clip-export` — export a clip with captions via Remotion
  - *(third function)*
- **Notes:**
  - `INNGEST_DEV=1` only for local dev (do NOT set on Vercel/Railway)
  - `/api/inngest` must be excluded from Clerk middleware (public route)
  - Inngest calls the Railway worker for actual execution (yt-dlp, ffmpeg, Remotion)
  - Vercel endpoint is for function registration; Railway runs the actual heavy work

---

### 🚂 Worker Hosting — Railway
- **URL:** https://railway.com
- **Dashboard:** https://railway.com/project/eb72a45f-a20a-4ffa-a944-5c80b95b6331
- **Docs:** https://docs.railway.com
- **Plan:** Trial → Hobby
- **Account:** `nareshipme@gmail.com`
- **Project:** `clipcrafter-worker`
- **Service:** `clipcrafter-app`
- **Public URL:** `https://clipcrafter-app-production.up.railway.app`
- **Used for:** Running yt-dlp, ffmpeg, Remotion — binaries not available on Vercel serverless
- **Notes:**
  - Same Next.js codebase as Vercel, but runs as a persistent server (not serverless)
  - Has all env vars set (R2, Supabase, Sarvam, Gemini, Inngest keys)
  - Auto-deploys via `railway up` CLI or GitHub push

---

### 🌐 Frontend Hosting — Vercel
- **URL:** https://vercel.com
- **Dashboard:** https://vercel.com/clipcrafterapp-9925s-projects/toolnexus-app
- **Docs:** https://vercel.com/docs
- **Plan:** Hobby (free)
- **Account:** `clipcrafterapp@gmail.com`
- **Production URL:** `https://toolnexus-app.vercel.app`
- **Used for:** Hosting Next.js frontend + API routes (auth, DB queries, Inngest trigger)
- **Notes:**
  - Does NOT run yt-dlp/ffmpeg/Remotion (serverless = no binary support)
  - Inngest functions registered here but executed on Railway
  - All env vars set via `vercel env` (no trailing newlines — causes signing key mismatch)

---

### 🎙️ Transcription (Primary) — Sarvam AI
- **URL:** https://sarvam.ai
- **Dashboard:** https://dashboard.sarvam.ai
- **Docs:** https://docs.sarvam.ai
- **Plan:** Pay-as-you-go (₹30/hr)
- **Model:** Saaras v3 (Batch API with diarization)
- **Used for:** Primary speech-to-text, optimized for Indian languages
- **Env vars:** `SARVAM_API_KEY`, `TRANSCRIPTION_PROVIDER=sarvam`
- **API flow:**
  1. `POST /speech-to-text/job/v1` — create job
  2. `POST /speech-to-text/job/v1/upload-files` — get presigned upload URL
  3. `PUT <presigned>` — upload audio (Azure Blob, requires `x-ms-blob-type: BlockBlob`)
  4. `POST /speech-to-text/job/v1/{id}/start` — start job
  5. `GET /speech-to-text/job/v1/{id}/status` — poll until `Completed`
  6. `POST /speech-to-text/job/v1/download-files` — get presigned download URL
  7. `GET <presigned>` — fetch transcript JSON

---

### 🤖 Transcription (Fallback) — Modal (faster-whisper)
- **URL:** https://modal.com
- **Dashboard:** https://modal.com/apps/nareshipme/clipcrafter-transcribe
- **Docs:** https://modal.com/docs
- **Plan:** Free tier ($30/mo credit)
- **Account:** `nareshipme` (nareshipme@gmail.com)
- **Model:** faster-whisper on CUDA (nvidia/cuda:12.1.1)
- **Endpoint:** `https://nareshipme--clipcrafter-transcribe-transcribe-endpoint.modal.run`
- **Used for:** Fallback when Sarvam fails or is unavailable
- **Notes:**
  - Token stored in `~/.modal.toml`
  - CUDA base image required — debian_slim missing libcublas

---

### 💬 Transcription (Last Resort) — Groq
- **URL:** https://console.groq.com
- **Docs:** https://console.groq.com/docs
- **Plan:** Free tier
- **Model:** `whisper-large-v3`
- **Used for:** Last fallback in transcription chain
- **Env vars:** `GROQ_API_KEY`
- **Notes:**
  - Free tier cap: 7,200 audio-seconds/hour — avoid as primary
  - Auto-chunks audio >24MB

---

### ✨ AI (Highlights + Captions) — Google Gemini
- **URL:** https://aistudio.google.com
- **Docs:** https://ai.google.dev/docs
- **Plan:** Free tier (Google AI Studio)
- **Models:** `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-flash-latest` (fallback chain)
- **Used for:** Generating highlight clips from transcript, caption text
- **Env vars:** `GEMINI_API_KEY`, `GEMINI_MODEL` (optional override)
- **Notes:**
  - Gemini 1.5 fully deprecated 2026-03-21 — use 2.x models only
  - Override model via `GEMINI_MODEL` env var

---

### 🎬 Caption Video Rendering — Remotion
- **URL:** https://www.remotion.dev
- **Docs:** https://www.remotion.dev/docs
- **Plan:** Free (self-hosted rendering)
- **Version:** `remotion@4.0.438`
- **Used for:** Rendering MP4 clips with TikTok-style captions
- **Notes:**
  - Runs as a spawned Node script (`scripts/remotion-render.mjs`) outside Next.js
  - Must be excluded from Next.js bundle (`serverExternalPackages` in `next.config.ts`)
  - Requires HTTPS video URLs — never pass local file paths
  - Uses `@remotion/captions` for TikTok-style caption pages
  - Chromium (bundled) fetches video from R2 presigned URLs

---

### 📹 YouTube Download — yt-dlp
- **URL:** https://github.com/yt-dlp/yt-dlp
- **Install:** `/usr/local/bin/yt-dlp` (v2026.03.17+)
- **Used for:** Downloading YouTube videos for processing
- **Notes:**
  - Cookies stored in R2 at `config/yt-cookies.txt` (downloaded to `/tmp` at runtime)
  - Cookies exported from browser via "Get cookies.txt LOCALLY" Chrome extension
  - Player client: `web,android` (with cookies)
  - Railway datacenter IPs are blocked by YouTube without cookies
  - Refresh cookies periodically (they expire)

---

### 🎞️ Audio/Video Processing — ffmpeg
- **URL:** https://ffmpeg.org
- **Wrapper:** `fluent-ffmpeg@2.1.3`
- **Used for:** Extracting MP3 audio from downloaded video
- **Notes:**
  - Mac Homebrew ffmpeg has no `libfreetype` → `drawtext` filter unavailable
  - Use Remotion for captions, not ffmpeg drawtext

---

### 🔄 React Flow (Knowledge Graph) — @xyflow/react
- **URL:** https://reactflow.dev
- **Docs:** https://reactflow.dev/docs
- **Version:** `@xyflow/react@12.10.1`
- **Used for:** VideoKnowledgeGraph — visual LR layout of topics + segments

---

### 📝 Blog Publishing — dev.to
- **URL:** https://dev.to/nareshipme
- **API Docs:** https://developers.forem.com/api
- **Account:** `nareshipme` (Naresh's personal)
- **Used for:** Auto-publishing daily engineering posts (cron at 9 PM IST)
- **Env vars:** `DEVTO_API_KEY`
- **Post log:** `docs/devto-posts.md`
- **Style:** General/educational — NOT product-specific

---

## Transcription Provider Chain

```
TRANSCRIPTION_PROVIDER=sarvam
        │
        ▼
   Sarvam Saaras v3  ──(fail)──►  Modal faster-whisper  ──(fail)──►  Groq whisper-large-v3
   (primary, ₹30/hr)              (fallback, CUDA)                    (last resort, free)
```

---

## Key Gotchas

| Issue | Detail |
|-------|--------|
| Inngest v4 | Triggers empty in manifest — stay on v3.52.7 |
| Inngest step isolation | Temp paths must use `projectId` not `Date.now()` (each step = fresh process) |
| Clerk vs Supabase IDs | `user_xxx` ≠ UUID — use `getSupabaseUserId()` helper |
| Vercel env newlines | Adding env vars with newlines breaks signing key — use `echo -n` |
| `/api/inngest` auth | Must be excluded from Clerk middleware (public route) |
| R2 client init | Lazy-initialized via Proxy to avoid "credential not valid" at module load |
| YouTube bot detection | Railway IPs blocked — cookies required from logged-in browser |
| yt-dlp cookies expiry | Refresh `config/yt-cookies.txt` in R2 periodically |
| Whisper hallucination | Loops phrases on silence/background music |
| Gemini 1.5 | Fully deprecated 2026-03-21 — use 2.x fallback chain |
| Remotion + Next.js | Must be in `serverExternalPackages` — cannot bundle |
| Remotion video src | Must be HTTPS — Chromium can't fetch local paths |
| Mac ffmpeg drawtext | Homebrew build missing libfreetype — use Remotion for captions |

---

## Credentials Location

All API keys and secrets: `~/Desktop/ToolNexus-Credentials.md`

Local env: `~/dev/toolnexus-app/.env.local`
