export const LOADING_MESSAGES: Record<string, string[]> = {
  pending: [
    "Queued — warming up the engines…",
    "Queued — getting ready for liftoff…",
    "Queued and ready to roll…",
  ],
  processing: [
    "Summoning your video from the internet…",
    "Bribing YouTube servers…",
    "Fetching the goods…",
    "Negotiating with the cloud…",
  ],
  extracting_audio: [
    "Separating the voice from the chaos…",
    "Stripping the visuals (keeping the soul)…",
    "Finding the good bits…",
    "Distilling audio gold…",
  ],
  transcribing: [
    "Teaching the AI to listen…",
    "Converting sound waves to words…",
    "Eavesdropping scientifically…",
    "Transcribing at the speed of light (almost)…",
  ],
  generating_highlights: [
    "Finding your viral moments…",
    "Asking the AI what slaps…",
    "Surfacing the gold…",
    "Identifying banger clips…",
    "Running the vibe check…",
  ],
  completed: [
    "Done! Your clips are ready 🎬",
    "All wrapped up. Time to shine.",
    "Clips served. You're welcome.",
  ],
  failed: ["Something went sideways…", "The AI had a moment. Please retry."],
};

export function getLoadingMessage(status: string, index: number): string {
  const messages = LOADING_MESSAGES[status] ?? ["Working on it…"];
  return messages[index % messages.length];
}
