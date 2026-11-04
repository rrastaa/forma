import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { SelectedFile } from "../types/file";
import type { ProgressData } from "../types/operation";

import {
  convertPdf,
  convertImageToPdf,
  type ConversionFormat,
} from "../services/convertService";

export function useConvert(selectedFiles: SelectedFile[]) {
  const [isConverting, setIsConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<string[] | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const [conversionProgress, setConversionProgress] = useState<ProgressData>({
    current: 0,
    total: 0,
    percentage: 0,
    message: "Preparing conversion...",
  });

  // Listen to conversion progress from Rust backend.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const setupListener = async () => {
      const cleanup = await listen<ProgressData>(
        "conversion-progress",
        (event) => {
          setConversionProgress(event.payload);
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

  // Convert selected file.
  const handleConvert = useCallback(
    async (format: ConversionFormat) => {
      const selectedFile = selectedFiles[0];

      if (!selectedFile) return;

      if (selectedFiles.length > 1) {
        setConversionError("Multiple file conversion is not supported yet.");
        return;
      }

      const extension = selectedFile.extension.toLowerCase();
      const isPdf = extension === "pdf";

      if (
        (isPdf && format === "pdf") ||
        (!isPdf && format !== "pdf")
      ) {
        return;
      }

      setIsConverting(true);
      setConversionResult(null);
      setConversionError(null);

      try {
        let result: string[];

        if (isPdf) {
          result = await convertPdf(
            selectedFile.path,
            format as Exclude<ConversionFormat, "pdf">
          );
        } else {
          result = await convertImageToPdf(selectedFile.path);
        }

        setConversionResult(result);
      } catch (error) {
        setConversionError(String(error));
      } finally {
        setIsConverting(false);
      }
    },
    [selectedFiles]
  );

  const resetConversion = useCallback(() => {
    setConversionResult(null);
    setConversionError(null);
  }, []);

  return {
    isConverting,
    conversionResult,
    conversionError,
    conversionProgress,
    handleConvert,
    resetConversion,
  };
}
