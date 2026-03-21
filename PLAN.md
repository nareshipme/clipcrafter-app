
---

## Phase 8 — Migrate Prototype Tools (from ~/dev/toolnexus)

The original prototype has these tools to migrate to ClipCrafter:

### 8.1 — VideoTrimmer (core tool)
- Multi-segment trim with speed control per segment
- YouTube URL + file upload input
- AI highlight extraction (uses transcript → Gemini)
- Auto-remove silence
- Captions generation (via Sarvam STT) with language selection
- Caption overlay on export
- Preview player with segment markers
- Export trimmed video (ffmpeg server-side or client-side WebCodecs)

### 8.2 — SmartVideoCropper
- Aspect ratio presets: 9:16 (Reels/TikTok), 1:1 (Square), 4:5 (Portrait), 16:9 (Landscape)
- Drag-to-reposition subject within frame
- Background color fill
- Live preview + export

### 8.3 — VideoPolisher (captions tool)
- Auto-generate captions from audio (Sarvam STT)
- Caption styles: modern, hormozi (yellow/black), neon, minimal
- Per-caption emoji enrichment (Gemini)
- Draggable caption box positioning
- Edit captions manually
- Export with burned-in captions

### 8.4 — BackgroundRemover
- AI background removal (Gemini vision)
- Image upload + preview
- Export as PNG with transparency

### 8.5 — ImageAnalyzer
- Analyze any image with Gemini vision
- Free-form Q&A about image content

### 8.6 — RegexGenerator
- Natural language → regex via Gemini
- Test against sample strings

### 8.7 — SpriteGenerator + SpritesheetAnimator
- Upload character image → AI analyzes animations
- Generate sprite sheet frames
- Preview animation

### 8.8 — StyleChanger
- Apply AI style transfer to images

### Tool Architecture
- All tools accessible from dashboard sidebar
- Tools that need video use the project system (transcript reuse)
- Tools that are standalone (BackgroundRemover, RegexGenerator, etc.) render inline
- Each tool gets its own route: /dashboard/tools/[toolId]

---

## Phase 9 — Billing (Stripe)
- Free: 30 min/month audio, watermarked export
- Pro: 10hr/month, $9/mo
- Team: unlimited, $29/mo

## Phase 10 — Polish
- Landing page improvements
- Error handling + toasts (react-hot-toast)
- Realtime via Supabase channels (replace polling)
- Mobile testing
