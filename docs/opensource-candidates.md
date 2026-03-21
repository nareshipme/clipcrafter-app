# Open Source Candidates

Modules that could be extracted and open sourced independently.

## Criteria
- ✅ No business-sensitive logic
- ✅ Generic / useful to other developers
- ✅ Good test coverage
- ✅ Well documented

---

## 🟢 Ready to Open Source
*(none yet)*

## 🟡 Candidates (needs evaluation)

| Module | Location | Description | Blocker |
|--------|----------|-------------|---------|
| BDD Helpers | `src/test/bdd.ts` | Feature/Scenario/Given/When/Then wrappers for Vitest | Needs README + npm package scaffold (code itself is done) |
| R2 Upload Utility | `src/lib/r2.ts` | Presigned URL generation for Cloudflare R2 | Needs env abstraction — currently reads `process.env.*` directly; should accept config object |
| Auth Sync | `src/lib/auth-sync.ts` | Clerk → Supabase user sync pattern | Too coupled to our schema for now |
| Inngest Client Scaffold | `src/lib/inngest.ts` + `src/app/api/inngest/route.ts` | Minimal Inngest setup for Next.js App Router | Too thin to be useful standalone; wait until more function patterns emerge |

## 🔴 Not Suitable
| Module | Reason |
|--------|--------|
| API routes | Business logic, pricing, user data |
| Supabase schema | Business-specific |
| Stripe integration | Business logic |

---

## Notes
- When a module is ready, extract to `packages/<name>` with its own `package.json`
- Publish to npm under `@toolnexus/<name>` or as standalone

## Updated 2026-03-21

| Module | Location | Description | Blocker |
|--------|----------|-------------|---------|
| Transcription Provider Abstraction | `src/lib/transcribe.ts` | Multi-provider STT with Sarvam/Modal/Groq fallback chain | Needs env config docs; provider-agnostic enough to be useful |
| Audio Chunker | `src/lib/groq.ts` (transcribeAudio) | Auto-chunk long audio for APIs with size limits; ffmpeg-based | Extract into standalone `chunk-audio` util |
| Gemini Model Fallback | `src/lib/gemini.ts` | Try model list in order, retry on deprecated/404 errors | Could be a generic "model-with-fallback" pattern for any LLM |
| Processing Logger | `src/inngest/functions/process-video.ts` (makeLogger) | Step-by-step job logger that flushes to DB at end | Extract into reusable Inngest middleware |
| Supabase User Resolver | `src/lib/user.ts` | get-or-create Supabase user from Clerk ID | Too project-specific currently; needs generalisation |
