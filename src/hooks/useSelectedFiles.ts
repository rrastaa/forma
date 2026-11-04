
import { useCallback, useState } from "react";
import type { SelectedFile } from "../types/file";
import { getSelectedFinderFiles } from "../services/fileService";

export function useSelectedFiles() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  const loadSelectedFiles = useCallback(async () => {
    try {
      const files = await getSelectedFinderFiles();
      setSelectedFiles(files);
      return files;
    } catch (error) {
      console.error("[FORMA] Failed to get selected files:", error);
      setSelectedFiles([]);
      return [];
    }
  }, []);

  const clearSelectedFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  return {
    selectedFiles,
    setSelectedFiles,
    loadSelectedFiles,
    clearSelectedFiles,
  };
}
