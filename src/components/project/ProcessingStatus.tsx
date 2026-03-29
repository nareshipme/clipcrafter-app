"use client";

import { useState, useEffect, Fragment } from "react";
import { ProjectStatus } from "./types";
import { getLoadingMessage } from "@/lib/loadingMessages";

const STAGES = [
  { label: "Downloading video", short: "Download" },
  { label: "Extracting audio", short: "Audio" },
  { label: "Transcribing", short: "Transcribe" },
  { label: "Generating highlights", short: "Clips" },
  { label: "Finalizing", short: "Done" },
] as const;

function getActiveStep(status: ProjectStatus): number {
  if (status === "processing") return 0;
  if (status === "extracting_audio") return 1;
  if (status === "transcribing") return 2;
  if (status === "generating_highlights") return 3;
  if (status === "completed") return 4;
  return -1;
}

interface ProcessingStepperProps {
  status: ProjectStatus;
}

function ProcessingStepper({ status }: ProcessingStepperProps) {
  const activeStep = getActiveStep(status);
  return (
    <div
      data-testid="processing-stepper"
      className="bg-gray-900 border border-gray-800 rounded-xl p-5"
    >
      <div className="flex items-start w-full">
        {STAGES.map((stage, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;
          const isLast = i === STAGES.length - 1;
          const dotColor = isDone
            ? "bg-violet-500"
            : isActive
              ? "bg-yellow-400 animate-pulse"
              : "bg-gray-700";
          const labelColor = isDone
            ? "text-violet-400"
            : isActive
              ? "text-yellow-400 font-medium"
              : "text-gray-500";
          return (
            <Fragment key={stage.label}>
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                <div className="relative text-center leading-tight">
                  <span aria-hidden="true" className={`text-[10px] ${labelColor}`}>
                    {stage.short}
                  </span>
                  {/* Full labels kept for screen readers and tests */}
                  <span className={`sr-only ${labelColor}`}>{stage.label}</span>
                </div>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-px mt-1.5 mx-0.5 self-start ${isDone ? "bg-violet-500" : "bg-gray-700"}`}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface FailedStateProps {
  errorMessage: string | null;
  onRetry: () => void;
}

function FailedState({ errorMessage, onRetry }: FailedStateProps) {
  return (
    <div className="bg-red-950 border border-red-800 rounded-xl p-5 flex flex-col gap-3">
      <h2 className="text-red-400 font-semibold">Processing failed</h2>
      {errorMessage && <p className="text-red-300 text-sm">{errorMessage}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="self-start rounded-lg bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors min-h-[44px]"
      >
        Retry
      </button>
    </div>
  );
}

export interface ProcessingStatusProps {
  status: ProjectStatus;
  errorMessage: string | null;
  onRetry: () => void;
}

export function ProcessingStatus({ status, errorMessage, onRetry }: ProcessingStatusProps) {
  const isProcessing = !["completed", "failed"].includes(status) && status !== "pending";
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx((i) => i + 1), 3000);
    return () => clearInterval(id);
  }, [status]);

  const message = getLoadingMessage(status, msgIdx);

  return (
    <>
      {isProcessing && (
        <div className="flex flex-col gap-3 w-full">
          {/* Fixed-height container prevents layout shift when message text changes length */}
          <div className="flex flex-col gap-1 w-full min-h-[48px]">
            <p className="text-sm text-gray-300 font-medium transition-opacity duration-500 line-clamp-2">
              {message}
            </p>
            <p className="text-xs text-gray-600">Usually takes 2–3 min for a 30 min video</p>
          </div>
          <ProcessingStepper status={status} />
        </div>
      )}
      {status === "failed" && <FailedState errorMessage={errorMessage} onRetry={onRetry} />}
      {status === "pending" && (
        <div className="flex flex-col gap-1 w-full min-h-[48px]">
          <p className="text-sm text-gray-400 transition-opacity duration-500 line-clamp-2">
            {message}
          </p>
          <p className="text-xs text-gray-600">Usually takes 2–3 min for a 30 min video</p>
        </div>
      )}
    </>
  );
}
