
import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { SelectedFile } from "../../types/file";
import type { ProgressData } from "../../types/operation";

import {
  splitPdf,
  type SplitMode,
} from "../../services/splitService";

export function useSplit(selectedFiles: SelectedFile[]) {
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitResult, setSplitResult] = useState<string[] | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  const [splitProgress, setSplitProgress] = useState<ProgressData>({
    current: 0,
    total: 0,
    percentage: 0,
    message: "Preparing split...",
  });

  const [splitMode, setSplitMode] = useState<SplitMode>("all");
  const [pageRanges, setPageRanges] = useState("");

  // Listen to split progress from Rust backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const setupListener = async () => {
      const cleanup = await listen<ProgressData>(
        "split-progress",
        (event) => {
          setSplitProgress(event.payload);
        }
      );

      if (cancelled) {
        cleanup();
      } else {
        unlisten = cleanup;
      }
    };

    void setupListener();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Execute PDF split
  const handleSplit = useCallback(async () => {
    const selectedFile = selectedFiles[0];

    if (!selectedFile) return;

    if (selectedFile.extension.toLowerCase() !== "pdf") {
      setSplitError("Only PDF files can be split.");
      return;
    }

    if (splitMode === "range" && !pageRanges.trim()) {
      setSplitError("Please enter page ranges.");
      return;
    }

    setIsSplitting(true);
    setSplitResult(null);
    setSplitError(null);

    try {
      const result = await splitPdf(
        selectedFile.path,
        splitMode,
        splitMode === "range" ? pageRanges : null
      );

      setSplitResult(result);
    } catch (error) {
      setSplitError(String(error));
    } finally {
      setIsSplitting(false);
    }
  }, [selectedFiles, splitMode, pageRanges]);

  // Reset split state
  const resetSplit = useCallback(() => {
    setSplitResult(null);
    setSplitError(null);
  }, []);

  const setSplitErrorMessage = useCallback((message: string) => {
    setSplitError(message);
  }, []);

  return {
    isSplitting,
    splitResult,
    splitError,
    splitProgress,
    splitMode,
    setSplitMode,
    pageRanges,
    setPageRanges,
    handleSplit,
    resetSplit,
    setSplitErrorMessage
  };
}
