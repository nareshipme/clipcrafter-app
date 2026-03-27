import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processVideo } from "@/inngest/functions/process-video";
import { clipExport } from "@/inngest/functions/clip-export";
import { generateClips } from "@/inngest/functions/generate-clips";
import { stitchClips } from "@/inngest/functions/stitch-clips";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processVideo, clipExport, generateClips, stitchClips],
});
