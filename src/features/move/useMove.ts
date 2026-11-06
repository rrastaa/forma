import { useCallback, useState } from "react";
import type { SelectedFile } from "../../types/file";
import {
  selectDestinationFolder,
  moveFiles,
  askMoveConflict,
  type MoveConflictAction,
  type MoveResult,
} from "../../services/moveService";

export function useMove(selectedFiles: SelectedFile[]) {
  const [destination, setDestination] = useState<string | null>(null);

  // Dipertahankan sementara agar integrasi App.tsx yang lama tidak rusak.
  const [conflictAction, setConflictAction] =
    useState<MoveConflictAction>("keep_both");

  const [isMoving, setIsMoving] = useState(false);
  const [moveResults, setMoveResults] = useState<MoveResult[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);

  const chooseDestination = useCallback(async () => {
    try {
      const folder = await selectDestinationFolder();

      if (folder) {
        setDestination(folder);
        setMoveResults([]);
        setMoveError(null);
      }
    } catch (error) {
      setMoveError(String(error));
    }
  }, []);

  const handleMove = useCallback(async () => {
    if (!destination || selectedFiles.length === 0) return;

    setIsMoving(true);
    setMoveError(null);
    setMoveResults([]);

    const results: MoveResult[] = [];

    try {
      for (const file of selectedFiles) {
        try {
          // First attempt: check for conflicts.
          const initialResults = await moveFiles(
            [file.path],
            destination,
            "ask"
          );

          let result = initialResults[0];

          if (!result) continue;

          // Show native macOS dialog only when a conflict exists.
          if (result.status === "conflict") {
            const action = await askMoveConflict(file.name);

            const resolvedResults = await moveFiles(
              [file.path],
              destination,
              action
            );

            result = resolvedResults[0] ?? result;
          }

          results.push(result);
        } catch (error) {
          results.push({
            source_path: file.path,
            destination_path: "",
            status: "failed",
            message: String(error),
          });
        }

        // Update results after each file.
        setMoveResults([...results]);
      }
    } catch (error) {
      setMoveError(String(error));
    } finally {
      setIsMoving(false);
    }
  }, [selectedFiles, destination]);

  const resetMove = useCallback(() => {
    setDestination(null);
    setConflictAction("keep_both");
    setMoveResults([]);
    setMoveError(null);
  }, []);

  return {
    destination,
    setDestination,
    conflictAction,
    setConflictAction,
    isMoving,
    moveResults,
    moveError,
    chooseDestination,
    handleMove,
    resetMove,
  };
}