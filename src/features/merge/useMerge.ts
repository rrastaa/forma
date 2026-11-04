import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { SelectedFile } from "../../types/file";
import type { ProgressData } from "../../types/operation";

import { mergePdf } from "../../services/mergeService";

export function useMerge(selectedFiles: SelectedFile[]) {
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const [mergeProgress, setMergeProgress] = useState<ProgressData>({
    current: 0,
    total: 0,
    percentage: 0,
    message: "Preparing merge...",
  });

  // Listen to merge progress from Rust backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const setupListener = async () => {
      const cleanup = await listen<ProgressData>(
        "merge-progress",
        (event) => {
          setMergeProgress(event.payload);
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

  // Execute PDF merge
  const handleMerge = useCallback(async () => {
    if (selectedFiles.length < 2) {
      setMergeError("Select at least 2 PDF files.");
      return;
    }

    const allPdf = selectedFiles.every(
      (file) => file.extension.toLowerCase() === "pdf"
    );

    if (!allPdf) {
      setMergeError("All selected files must be PDF.");
      return;
    }

    setIsMerging(true);
    setMergeResult(null);
    setMergeError(null);

    try {
      const result = await mergePdf(
        selectedFiles.map((file) => file.path)
      );

      setMergeResult(result);
    } catch (error) {
      setMergeError(String(error));
    } finally {
      setIsMerging(false);
    }
  }, [selectedFiles]);

  // Reset merge state
  const resetMerge = useCallback(() => {
    setMergeResult(null);
    setMergeError(null);
  }, []);

  const setMergeErrorMessage = useCallback((message: string) => {
    setMergeError(message);
  }, []);

  return {
    isMerging,
    mergeResult,
    mergeError,
    mergeProgress,
    handleMerge,
    resetMerge,
    setMergeErrorMessage,
  };
}
