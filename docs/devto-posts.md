# Dev.to Posts Log

Track all published dev.to posts here.

## Format
```
## YYYY-MM-DD — [Post Title](url)
Tags: tag1, tag2
Summary: One line about what the post covers.
```

---

## Posts

<!-- Add new posts here, newest first -->

## 2026-03-24 — [Busting Docker Build Cache on Demand with ARG CACHEBUST (and Why You'd Need It)](https://dev.to/nareshipme/busting-docker-build-cache-on-demand-with-arg-cachebust-and-why-youd-need-it-3j9g)
Tags: docker, devops, nodejs, railway
Summary: Two techniques for controlling Docker layer caching: merging coupled RUN commands into atomic layers, and using ARG CACHEBUST to force cache invalidation on demand without touching Dockerfile logic.

## 2026-03-23 — [How to Run Remotion Inside a Next.js App Without Webpack Losing Its Mind](https://dev.to/nareshipme/how-to-run-remotion-inside-a-nextjs-app-without-webpack-losing-its-mind-40mc)
Tags: nextjs, remotion, typescript, docker
Summary: 5 concrete fixes for embedding Remotion in a Next.js 15 App Router project — serverExternalPackages, spawning a standalone render script, separate tsconfig for src/remotion, file:// vs HTTPS URLs for Chromium, and Docker setup with CHROME_EXECUTABLE_PATH.

## 2026-03-22 — [Inngest Retries and the Stale Event Payload Trap](https://dev.to/nareshipme/inngest-retries-and-the-stale-event-payload-trap-33ce)
Tags: inngest, typescript, nextjs, webdev
Summary: Why Inngest retries fail when you read mutable data from the event payload — and the fix: pass only stable IDs in events, read everything else fresh from the DB inside each step.

## 2026-03-21 — [Direct-to-R2 Uploads with Presigned URLs in Next.js 15](https://dev.to/nareshipme/direct-to-r2-uploads-with-presigned-urls-in-nextjs-15-5c4l)
Tags: nextjs, typescript, cloudflare, webdev
Summary: How to implement direct-to-R2 file uploads using presigned URLs in Next.js 15 App Router — skipping the server proxy, with Vitest tests and security tips.

## 2026-03-20 — [Background Jobs in Next.js 15 with Inngest: Step Functions, Type-Safe Events, and TDD](https://dev.to/nareshipme/background-jobs-in-nextjs-15-with-inngest-step-functions-type-safe-events-and-tdd-1kj6)
Tags: nextjs, typescript, inngest, webdev
Summary: How to wire up Inngest for background job processing in Next.js 15 App Router — covering step functions, typed events, the serve route, triggering from API routes, and TDD with Vitest mocks.

## 2026-03-20 — [How to Sync Clerk Users to Supabase with Webhooks (TDD Approach)](https://dev.to/nareshipme/building-toolnexus-wiring-clerk-auth-to-supabase-with-tdd-1acl)
Tags: nextjs, typescript, supabase, clerk
Summary: How to sync Clerk users to Supabase via webhooks using a TDD approach. Covers mapClerkUserToDb, upsertUserFromClerk, Svix signature verification, and a Next.js 15 App Router gotcha with runtime = 'nodejs'.

## Post Ideas (not yet written — sourced from bug-log.md)

### High priority (most useful to community)
1. **"The Inngest temp file trap: why your files disappear between steps"**
   - Inngest step isolation, Date.now() pitfall, stable path fix
   - Tags: inngest, nextjs, typescript, serverless

2. **"Don't protect everything under /api — safely mixing auth and public routes in Next.js + Clerk"**
   - Inngest/webhook routes bypassing Clerk middleware
   - Tags: nextjs, clerk, auth, typescript

3. **"Sarvam AI Batch API: the correct upload/download flow (Node.js)"**
   - Presigned URL flow, diarization, step-by-step with code
   - Tags: sarvam, speechtotext, indic, nodejs

4. **"Whisper hallucination on silence: why your transcript loops"**
   - VAD, live streams, how to fix
   - Tags: whisper, speechtotext, ai, python

5. **"Groq Whisper's 25MB limit: auto-compress audio before transcription"**
   - ffmpeg compression, chunking strategy
   - Tags: groq, whisper, ffmpeg, typescript

6. **"Audio chunking for long-form transcription: splitting and stitching with correct timestamps"**
   - ffmpeg segment, offset arithmetic, transcript stitching
   - Tags: audio, ffmpeg, typescript, ai

7. **"Clerk userId is NOT a UUID: the Supabase foreign key mistake"**
   - getSupabaseUserId helper, why clerk ID ≠ DB UUID
   - Tags: clerk, supabase, nextjs, typescript
