import { Artifact, Clip, StatusData } from "./types";

export interface ProjectDataResult {
  data: StatusData | null;
  loading: boolean;
  artifacts: Record<string, Artifact> | null;
  clips: Clip[] | null;
  clipsStatus: string;
  selectedTopic: string | null;
  setSelectedTopic: (t: string | null) => void;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  clipCount: number | "auto";
  setClipCount: (v: number | "auto") => void;
  clipPrompt: string;
  setClipPrompt: (v: string) => void;
  clipTargetDuration: string;
  setClipTargetDuration: (v: string) => void;
  selectedClipIds: Set<string>;
  setSelectedClipIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  withCaptions: boolean;
  setWithCaptions: React.Dispatch<React.SetStateAction<boolean>>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  setDuration: (d: number) => void;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  isLooping: boolean;
  setIsLooping: React.Dispatch<React.SetStateAction<boolean>>;
  showCaptions: boolean;
  setShowCaptions: React.Dispatch<React.SetStateAction<boolean>>;
  isPreviewing: boolean;
  videoUrl: string | null;
  isYouTube: boolean;
  youTubeVideoId: string | null;
  transcriptOpen: boolean;
  setTranscriptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  downloadsOpen: boolean;
  setDownloadsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  howItRanOpen: boolean;
  setHowItRanOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: "list" | "graph";
  topicOverrides: Record<string, string>;
  setTopicOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleRetry: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleGenerateClips: () => Promise<void>;
  handleClipAction: (
    clipId: string,
    update: Partial<
      Pick<Clip, "status" | "caption_style" | "aspect_ratio" | "start_sec" | "end_sec">
    >
  ) => Promise<void>;
  handleExportClip: (clipId: string) => Promise<void>;
  handleExportBatch: () => Promise<void>;
  handleStitchExport: () => Promise<void>;
  togglePlay: () => void;
  seekToClip: (clip: Clip) => void;
  skipPrev: () => void;
  skipNext: () => void;
  handlePlayAll: () => void;
  stopPreviewing: () => void;
  handleTimeUpdate: () => void;
  handleLoadedMetadata: () => void;
  handleTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleHandleMouseDown: (e: React.MouseEvent, clipId: string, side: "start" | "end") => void;
  switchView: (mode: "list" | "graph") => void;
  updateTopicLabel: (originalTopic: string, label: string) => void;
}
