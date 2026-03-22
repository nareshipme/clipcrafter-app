# Rebuild Project Detail Page — Interactive Video Editor

## The core problem
The current project detail page (/dashboard/projects/[id]/page.tsx) shows static highlight cards with no video. The old prototype (~/dev/toolnexus) had a proper interactive video editor with a live video player, draggable timeline, preview buttons, silence removal, and caption overlay.

The new app has Sarvam transcription + AI highlights running server-side stored in Supabase, and the video in R2. The job is to bring the interactive player experience INTO the new app, using the R2 video presigned URL from the artifacts API.

## What to build

Rebuild `src/app/dashboard/projects/[id]/page.tsx` with a two-column layout:

### Left column (sidebar, w-[420px] shrink-0 on desktop, full width on mobile):
1. Project header — title, status badge, Back link, Delete button
2. Processing stepper — visible while processing
3. Error/Retry — on failure
4. Once completed:
   - "Generate AI Clips" button (or "Regenerate Clips" if clips exist) + clip count badge
   - Clip cards list (sorted by score desc), each showing:
     - Score badge: green if >=70, yellow if 40-69, red if <40, show "—" if score is 0
     - Clip title (bold, 2 lines max, text-ellipsis)
     - Start->End time, duration chip (e.g. "12.3s")
     - Hashtag pills (max 3, "+N more" label if more exist)
     - Bottom row: [✓ Approve] [✗ Reject] | [Style dropdown] [Ratio dropdown] | [Export]
     - Clicking the clip card body (not buttons) -> seeks video to clip.start_sec and previews it
     - Selected clip card -> violet-500 left border (border-l-4)
   - Collapsible "📝 Transcript" section (collapsed by default), showing transcript segments
   - Collapsible "📦 Downloads" section (collapsed by default), showing artifact download links
   - Collapsible "⚙️ How it ran" section (collapsed by default), showing processing log

### Right column (flex-1 min-w-0, sticky top on desktop):
A real interactive video editor, shown once project is completed AND videoUrl is available.

**Video Player:**
- native HTML5 `<video>` element using the R2 presigned URL from artifacts.video.url
- On timeupdate: update currentTime state
- On loadedmetadata: set duration state
- Caption overlay at bottom of video: find the transcript segment where currentTime is between seg.start and seg.end, show it as an overlay if showCaptions is true
- Loading state (spinner) while videoUrl is null but project is completed
- "No video available" fallback if artifacts.video.available is false

**Timeline scrubber (below video, h-20):**
- Full-width clickable bar, bg-gray-900
- Show ALL clips as colored bars positioned at (start_sec/duration*100%) with width ((end_sec-start_sec)/duration*100%):
  - approved: bg-green-600/60
  - rejected: bg-gray-700/40
  - pending: bg-violet-600/50
  - selected clip: slightly brighter + z-10
  - selected clip left/right edges: drag handles (w-3 h-full cursor-ew-resize, with a visual indicator bar)
- Current time playhead: absolute white vertical line at (currentTime/duration*100%)
- Clicking on the scrubber bar (not a handle): seek video to clicked position
- Dragging a clip handle: update start_sec or end_sec in local state optimistically, send PATCH on mouseup

**Controls bar (below timeline):**
Row 1: [⏮] [▶/⏸] [⏭]   current time / duration   [🔁 Loop] [▶ Play All]
Row 2: [Captions: toggle button]

- Loop: when active and video plays past active clip end_sec, jump back to start_sec
- Play All: plays clips in order (approved ones first, then others), jumping between them sequentially
- Captions toggle: shows/hides caption overlay

## Key state:
```
// video
videoRef: RefObject<HTMLVideoElement>
videoUrl: string | null  (from artifacts.video.url)
duration: number
currentTime: number
isPlaying: boolean
isLooping: boolean
showCaptions: boolean
isPreviewing: boolean  (play all mode)
previewClipIndex: number

// clips
clips: Clip[] | null
selectedClipId: string | null
clipsLoading: boolean

// project
data: StatusData | null
artifacts: Record<string, {url, label, available}> | null
```

## Behavior on load:
1. Fetch /api/projects/[id]/status on mount, poll every 3s while non-terminal
2. When status becomes "completed":
   a. Fetch /api/projects/[id]/artifacts -> set videoUrl from artifacts.video.url
   b. Fetch GET /api/projects/[id]/clips
   c. If GET returns empty array -> auto-trigger POST /api/projects/[id]/clips to generate clips
   d. Set clips state, auto-select first clip (setSelectedClipId(clips[0].id))
   e. Seek video to first clip's start_sec

## Timeline drag implementation:
Use mousedown + window mousemove/mouseup (no drag-and-drop API needed).
On mousedown on a handle:
  - record which clipId and side ("start" or "end")
  - on mousemove: calculate time from x position, update clip in local state
  - on mouseup: send PATCH /api/clips/[clipId] with new start_sec/end_sec, cleanup listeners

## Generate Clips flow:
- POST /api/projects/[id]/clips -> returns {clips: [...]}
- Set clips state, auto-select first clip
- Seek video to first clip start_sec

## Loop mode:
In onTimeUpdate: if isLooping and selectedClipId and currentTime >= selectedClip.end_sec, seek to selectedClip.start_sec

## Play All mode:
Track previewClipIndex (ref, not state to avoid re-render lag).
When Play All clicked: sort clips approved-first, set index to 0, seek to clips[0].start_sec, play.
In onTimeUpdate when isPreviewing: if currentTime >= clips[previewIndex].end_sec, go to next clip or stop.

## API changes needed:
Check src/app/api/clips/[clipId]/route.ts — the PATCH handler must also accept start_sec and end_sec in the request body (not just status/caption_style/aspect_ratio). Add that.

## Layout:
```
<div className="min-h-screen bg-gray-950 text-white flex flex-col">
  <header>...</header>
  <div className="flex flex-col lg:flex-row flex-1 min-h-0">
    <aside className="w-full lg:w-[420px] shrink-0 border-r border-gray-800 overflow-y-auto">
      ...left sidebar content...
    </aside>
    <main className="flex-1 flex flex-col min-w-0 lg:sticky lg:top-0 lg:h-screen">
      ...video player, timeline, controls...
    </main>
  </div>
</div>
```

## DO NOT:
- Do not add any npm packages — native HTML5 video only
- Do not use any external player libraries
- Do not show the old tab design
- Do not remove approve/reject/export/style/ratio controls
- Do not remove data-testid="status-badge", data-testid="processing-stepper", data-testid="generate-clips-btn"

## Files to edit:
1. src/app/dashboard/projects/[id]/page.tsx — full rewrite per above
2. src/app/api/clips/[clipId]/route.ts — add start_sec/end_sec to PATCH

## Commit when done:
- "feat(ui): interactive video player with clip timeline on project detail"

When completely done, run this exact command:
openclaw system event --text "Done: Interactive video player with clip timeline, sidebar clips flow, auto-generate on first visit" --mode now
