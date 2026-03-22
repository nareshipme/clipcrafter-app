# ClipCrafter — Task Tracker

> Simple kanban in markdown. Move items between sections as they progress.
> Format: `- [ ] task description` | **Priority:** 🔴 high / 🟡 medium / 🟢 low

---

## 🚧 In Progress

- [ ] Verify highlights timestamp sync is correct after two-pass fix (retry a project and check) 🔴

---

## 📋 Backlog

### Production Blockers
- [ ] **yt-dlp cookies**: `--cookies-from-browser chrome` only works in local dev. Need a cookie export strategy for Vercel/cloud deployment 🔴
- [ ] **Live stream downloads**: YouTube live URLs (`/live/`) are unreliable with yt-dlp. Add detection + user-facing warning to use regular `watch?v=` URLs 🔴
- [ ] **Clips table migration**: Currently applied manually via psql. Add to a proper migration script so it runs automatically on deploy 🟡

### Video Player
- [ ] YouTube iframe: clicking a clip card should seek the iframe to the right timestamp (requires YouTube IFrame API) 🟡
- [ ] Show video duration in project card on dashboard 🟢
- [ ] Timeline drag handles: test with an actual uploaded MP4 (not YouTube) 🟡

### Highlights & Clips
- [ ] Test two-pass highlights (Gemini) end-to-end with a real non-live YouTube video 🔴
- [ ] Clip export: Inngest `clip.export` job is a stub — implement actual ffmpeg trim + R2 upload 🟡
- [ ] Auto-regenerate clips when user hits Retry on a project (currently only generates on manual click) 🟢

### UX
- [ ] Dashboard: show project thumbnail (extract first frame via ffmpeg and store in R2) 🟢
- [ ] Empty state on dashboard feels bare — add example/demo project 🟢
- [ ] Mobile: test clip card controls at 390px (dropdowns may overflow) 🟡

### Infrastructure
- [ ] Set up proper Supabase migrations CLI flow (supabase link + supabase db push) instead of manual psql 🟡
- [ ] Add error alerting — currently failures are silent in production 🟡
- [ ] Git author config (name + email not set, showing as hostname) 🟢

---

## ✅ Done

- [x] Phase 1–7: Next.js scaffold, auth, DB, R2 upload, Inngest pipeline, dashboard UI
- [x] Phase 8: Clip queue with scores, hashtags, clip titles
- [x] Two-column layout: sidebar clips + interactive video player
- [x] Keep/Skip instead of Approve/Reject
- [x] YouTube iframe fallback for old projects
- [x] Fix: YouTube video now uploaded to R2 after yt-dlp download (playable in browser)
- [x] Fix: Highlights now use two-pass approach (MM:SS ranges → enrich) — accurate timestamps
- [x] Fix: Transcript segments passed as `[MM:SS] text` format to Gemini (not raw text)
- [x] Fix: Switch highlights provider to Gemini
- [x] Fix: yt-dlp uses `--cookies-from-browser chrome` to bypass bot detection (local dev)

---

*Last updated: 2026-03-22*

---

## 🗺️ Admin Panel — Plan

> Route: `/admin` — protected by ADMIN_EMAIL env var check (simple, no extra auth needed)

### Phase A — Stats Dashboard (build first)
- [ ] `/admin` — overview cards: total users, total projects, projects by status, R2 storage used 🔴
- [ ] R2 usage: list all objects with size, group by type (videos/ audio/ modal-tmp/) 🔴
- [ ] Project table: all projects across all users, status, created_at, user email 🟡
- [ ] User table: all users, plan, credits, joined date 🟡

### Phase B — User Management
- [ ] View any user's projects 🟡
- [ ] Change user plan (free → pro → team) — direct Supabase update 🟡
- [ ] Reset user credits 🟡
- [ ] Impersonate user (view their dashboard) — Clerk `__session` override 🟢

### Phase C — R2 Cleanup
- [ ] Delete orphaned R2 objects (modal-tmp/* — 308MB of stale Modal audio files) 🔴
- [ ] Button to purge all R2 files for a specific project 🟡
- [ ] Storage breakdown chart (videos vs audio vs temp) 🟢

### Phase D — Support Tools
- [ ] Retry any stuck/failed project from admin panel 🟡
- [ ] View full processing log for any project 🟡
- [ ] Send a notification/message to a user (webhook to their email) 🟢

### Implementation notes
- Auth: check `session.user.email === process.env.ADMIN_EMAIL` in middleware — simple and safe
- No new DB tables needed for Phase A/B
- Use Supabase service role (already have it) for cross-user queries
- R2 usage via ListObjectsV2 — paginate for large buckets
- Build as `/admin/page.tsx` with server components (no client polling needed for stats)

---

## 🗺️ Admin Panel — Plan

> Route: `/admin` — protected by ADMIN_EMAIL env var check (simple, no extra auth needed)

### Phase A — Stats Dashboard (build first)
- [ ] `/admin` overview cards: total users, total projects, R2 storage used, projects by status 🔴
- [ ] R2 usage: list all objects grouped by type (videos/ audio/ modal-tmp/) 🔴
- [ ] Projects table: all projects across all users with status + user email 🟡
- [ ] Users table: all users, plan, credits, joined date 🟡

### Phase B — User Management
- [ ] Change user plan (free → pro → team) — direct Supabase update 🟡
- [ ] Reset user credits 🟡
- [ ] View any user's projects 🟡

### Phase C — R2 Cleanup
- [ ] Delete orphaned modal-tmp/* files (308MB of stale old Modal audio) 🔴
- [ ] Purge all R2 files for a specific project 🟡

### Phase D — Support Tools
- [ ] Retry any stuck/failed project from admin panel 🟡
- [ ] View full processing log for any project 🟡

### Implementation notes
- Auth: `session.user.email === process.env.ADMIN_EMAIL` in middleware — no extra packages
- R2 usage via ListObjectsV2 (already have the client)
- All queries use Supabase service role (already wired)
- Build as server components — no client polling needed for stats

---

*Last updated: 2026-03-22*

---

## 🧠 Auto Clip Mode — Design

### Problem
Fixed clip count is wrong. A 5-min video might have 2 strong moments; a 45-min talk might cover 10 topics. "Give me 5" either duplicates or misses content.

### Insight
Reel-worthy clip = one clear topic + punchy moment. Right question: "how many topics did the speaker cover?" not "how many clips do you want?"

### Solution — Topic-first pipeline (Auto mode)

**Pass 1 — Topic discovery**
Prompt: "What distinct topics/themes does this speaker cover? Return a numbered list with a 1-sentence summary each."
→ ["AI job displacement", "future of education", "what creators should do now"]

**Pass 2 — Best clip per topic**
For each topic: "Find the single best 30–90s clip for this topic. Return MM:SS, MM:SS."
→ Runs in parallel (Promise.all), one Gemini call per topic

**Pass 3 — Enrich** (existing)
Score, hashtags, title — same as now

**UI changes:**
- clip count dropdown → add "Auto" option as default
- Each clip card shows a topic badge (e.g. "🏷 AI Jobs")
- Topic filter chips above clip list to filter by topic
- Clip DB table: add `topic` column (text)

**Manual mode** (existing) — user picks 3/5/7/10, no topic discovery

### Implementation
- [ ] Add `auto` mode to `generateHighlights` — triggers topic discovery first 🔴
- [ ] Pass 1.5: `discoverTopics(transcript)` → string[] 🔴
- [ ] Pass 2 change: loop topics, find best clip per topic (parallel) 🔴
- [ ] Add `topic TEXT` column to clips table in Supabase 🟡
- [ ] UI: "Auto" as default in count dropdown 🟡
- [ ] UI: topic badge on clip card 🟡
- [ ] UI: topic filter chips above clip list 🟢

*Last updated: 2026-03-22*

---

## 🎬 Phase 9 — Director's Cut

> Semantic graph + speaker tracking + Remotion compiler

### 9.1 — GeminiGraphService (Semantic Graph)
- [ ] `src/lib/gemini-graph.ts` — takes transcript, returns VideoGraph.json 🔴
- [ ] Schema: Nodes={id,label,summary,importance,speakerId}, Segments={id,topicId,start,end,hookSentence,intensityScore}, Edges={source,target,relationshipType}
- [ ] Prompt: "You are a Narrative Designer. Group segments into Topics (Nodes). For each Topic, identify Clips (Segments) with high viral potential. Define Flow (Edges): if A sets up a question B answers, create an edge."
- [ ] Store VideoGraph.json on project (new `video_graph` JSONB column)
- [ ] Trigger after clips/generate completes

### 9.2 — Speaker Tracking (MediaPipe)
- [ ] `scripts/analyze_focus.py` — MediaPipe face detection per second 🔴
- [ ] Input: video file + Sarvam diarization (speaker_id per segment)
- [ ] Output: `focus_data.json` mapping timestamp → { x_percent, y_percent, speakerId }
- [ ] Node wrapper: `src/lib/focus-tracker.ts` — calls python script, stores result in R2
- [ ] Run as Inngest step after video download

### 9.3 — VideoKnowledgeGraph UI (React Flow)
- [ ] Install `reactflow` package 🟡
- [ ] `src/components/VideoKnowledgeGraph.tsx` — node-link diagram from VideoGraph.json 🔴
- [ ] Nodes color-coded by speaker
- [ ] Click node → seek video player to that segment's start
- [ ] Multi-select mode → adds to SelectedClips
- [ ] Toggle button on project detail page: "Graph View" / "List View"

### 9.4 — Remotion Compiler
- [ ] Set up Remotion in project (`@remotion/core`, `@remotion/player`) 🟡
- [ ] `src/remotion/ViralReel.tsx` — composition using `<Series>` 🔴
- [ ] Accept `clips[]` + `focusData` via `getInputProps()`
- [ ] Per clip: `<Video>` with `transform: translate(${-focusX}%, ${-focusY}%) scale(1.5)` for 9:16 centering
- [ ] In-browser preview with `<Player>` component on project detail
- [ ] Server-side render trigger (Remotion CLI or Lambda) for final export

### Dependencies to install
- `reactflow` — node-link diagram
- `@remotion/core` `@remotion/player` `@remotion/cli` — video compiler
- `mediapipe` (Python) — face tracking

*Last updated: 2026-03-22*
