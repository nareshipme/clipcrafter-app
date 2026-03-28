"use client";

import { useProjectContext } from "@/components/project/ProjectContext";
import { ProcessingStatus } from "@/components/project/ProcessingStatus";
import { PlayerSection } from "@/components/project/PlayerSection";
import { CompletedSidebar } from "@/components/project/CompletedSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Segment } from "@/components/project/types";

function getCaptionText(p: ReturnType<typeof useProjectContext>): string | null {
  if (!p.showCaptions || !p.data?.transcript?.segments) return null;
  const seg = (p.data.transcript.segments as Segment[]).find(
    (s) => p.currentTime >= s.start && p.currentTime <= s.end
  );
  return seg ? seg.text.replace(/^\[Speaker \d+\]\s*/, "") : null;
}

function StudioSidebar() {
  const p = useProjectContext();
  return (
    <aside className="w-full lg:w-[400px] shrink-0 lg:border-r border-gray-800 overflow-y-auto">
      <div className="px-4 sm:px-5 py-5 flex flex-col gap-5">
        <ErrorBoundary>
          <CompletedSidebar
            clips={p.clips}
            sortedClips={p.sortedClips}
            computedGraph={p.computedGraph}
            viewMode={p.viewMode}
            clipsStatus={p.clipsStatus}
            selectedClipId={p.selectedClipId}
            selectedClipIds={p.selectedClipIds}
            selectedTopic={p.selectedTopic}
            withCaptions={p.withCaptions}
            topicOverrides={p.topicOverrides}
            clipCount={p.clipCount}
            clipPrompt={p.clipPrompt}
            clipTargetDuration={p.clipTargetDuration}
            data={p.data!}
            artifacts={p.artifacts}
            transcriptOpen={p.transcriptOpen}
            downloadsOpen={p.downloadsOpen}
            howItRanOpen={p.howItRanOpen}
            videoRef={p.videoRef}
            onSwitchView={p.switchView}
            onGenerateClips={p.handleGenerateClips}
            onSetClipCount={p.setClipCount}
            onSetClipPrompt={p.setClipPrompt}
            onSetClipTargetDuration={p.setClipTargetDuration}
            onSetSelectedTopic={p.setSelectedTopic}
            onSetSelectedClipId={p.setSelectedClipId}
            onSeekToClip={p.seekToClip}
            onToggleClipCheck={(clipId, checked) => {
              p.setSelectedClipIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(clipId);
                else next.delete(clipId);
                return next;
              });
            }}
            onSelectAll={(ids) => p.setSelectedClipIds(new Set(ids))}
            onDeselectAll={() => p.setSelectedClipIds(new Set())}
            onToggleCaptions={() => p.setWithCaptions((v) => !v)}
            onExportBatch={p.handleExportBatch}
            onClipAction={p.handleClipAction}
            onExportClip={p.handleExportClip}
            onSetSelectedClipIds={p.setSelectedClipIds}
            onUpdateTopicLabel={p.updateTopicLabel}
            onSetTopicOverrides={p.setTopicOverrides}
            onToggleTranscript={() => p.setTranscriptOpen((o) => !o)}
            onToggleDownloads={() => p.setDownloadsOpen((o) => !o)}
            onToggleHowItRan={() => p.setHowItRanOpen((o) => !o)}
            onStitchExport={p.handleStitchExport}
          />
        </ErrorBoundary>
      </div>
    </aside>
  );
}

function StudioPlayer() {
  const p = useProjectContext();
  const selectedClip = p.clips?.find((c) => c.id === p.selectedClipId) ?? null;
  const captionText = getCaptionText(p);
  return (
    <div className="flex-1 flex flex-col min-w-0 lg:sticky lg:top-0 lg:h-screen">
      <ErrorBoundary>
        <PlayerSection
          isCompleted={true}
          artifacts={p.artifacts}
          videoUrl={p.videoUrl}
          isYouTube={p.isYouTube}
          youTubeVideoId={p.youTubeVideoId}
          videoRef={p.videoRef}
          timelineRef={p.timelineRef}
          sortedClips={p.sortedClips}
          selectedClipId={p.selectedClipId}
          clips={p.clips}
          duration={p.duration}
          currentTime={p.currentTime}
          isPlaying={p.isPlaying}
          isLooping={p.isLooping}
          isPreviewing={p.isPreviewing}
          showCaptions={p.showCaptions}
          captionText={captionText}
          selectedClip={selectedClip}
          onTimeUpdate={p.handleTimeUpdate}
          onLoadedMetadata={p.handleLoadedMetadata}
          onSetIsPlaying={p.setIsPlaying}
          onTimelineClick={p.handleTimelineClick}
          onHandleMouseDown={p.handleHandleMouseDown}
          onTogglePlay={p.togglePlay}
          onSkipPrev={p.skipPrev}
          onSkipNext={p.skipNext}
          onToggleLoop={() => p.setIsLooping((l) => !l)}
          onPlayAll={p.handlePlayAll}
          onStopPreviewing={p.stopPreviewing}
          onToggleCaptions={() => p.setShowCaptions((c) => !c)}
          onSetSelectedClipId={p.setSelectedClipId}
          onSeekToClip={p.seekToClip}
        />
      </ErrorBoundary>
    </div>
  );
}

export default function StudioPage() {
  const p = useProjectContext();

  if (p.loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!p.data) return <p className="p-6 text-gray-400">Project not found.</p>;

  if (!p.isCompleted) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <ProcessingStatus
          status={p.data.status}
          errorMessage={p.data.error_message}
          onRetry={p.handleRetry}
        />
      </div>
    );
  }

  const selectedCount = p.selectedClipIds.size;

  return (
    <div className="flex flex-col lg:flex-row min-h-full">
      {/* Player: top on mobile, right column on desktop */}
      <div className="order-1 lg:order-2 lg:flex-1">
        <StudioPlayer />
      </div>
      {/* Sidebar: below player on mobile, left column on desktop */}
      <div className="order-2 lg:order-1">
        <StudioSidebar />
      </div>
      {/* Sticky export bar — mobile only, shown when clips are selected */}
      {selectedCount > 0 && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 px-4 py-3 bg-gray-950 border-t border-gray-800 z-20">
          <button
            type="button"
            onClick={p.handleExportBatch}
            className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
          >
            Export {selectedCount} clip{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
}
