
import { AnimatePresence, motion } from "motion/react";
import {
    FolderOpen,
    FolderInput,
    File,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
} from "lucide-react";

import type { SelectedFile } from "../../types/file";
import type {
    MoveConflictAction,
    MoveResult,
} from "../../services/moveService";
import { revealInFinder } from "../../services/fileService";

type MoveMenuProps = {
    isOpen: boolean;
    selectedFiles: SelectedFile[];
    destination: string | null;
    chooseDestination: () => void;

    // Temporarily retained for compatibility with the existing App.tsx.
    conflictAction: MoveConflictAction;
    setConflictAction: (action: MoveConflictAction) => void;

    isMoving: boolean;
    moveResults: MoveResult[];
    moveError: string | null;
    canMove: boolean;
    onMove: () => void;
    onBack: () => void;
};

function getFileName(path: string) {
    return path.split(/[\\/]/).pop() || path;
}

export function MoveMenu({
    isOpen,
    selectedFiles,
    destination,
    chooseDestination,
    isMoving,
    moveResults,
    moveError,
    canMove,
    onMove,
    onBack,
}: MoveMenuProps) {
    const successCount = moveResults.filter(
        (result) => result.status === "success"
    ).length;

    const skippedCount = moveResults.filter(
        (result) => result.status === "skipped"
    ).length;

    const failedCount = moveResults.filter(
        (result) => result.status === "failed"
    ).length;

    const handleReveal = async (path: string) => {
        try {
            await revealInFinder(path);
        } catch (error) {
            console.error("Failed to reveal file in Finder:", error);
        }
    };

    return (
        <AnimatePresence mode="popLayout">
            {isOpen && (
                <motion.section
                    key="move-menu"
                    className="stack-panel submenu-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 14, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                >
                    <div className="submenu-header">
                        <button className="back-button" onClick={onBack}>
                            <span>←</span> Back
                        </button>

                        <div>
                            <strong>Move Files</strong>
                            <span>Move selected files to another folder</span>
                        </div>
                    </div>

                    <div className="move-summary">
                        <div className="move-file-count">
                            <File size={18} />
                            <span>
                                {selectedFiles.length}{" "}
                                {selectedFiles.length === 1 ? "file" : "files"} selected
                            </span>
                        </div>

                        <div className="move-file-list">
                            {selectedFiles.map((file) => (
                                <div className="move-file-item" key={file.path}>
                                    <File size={14} />
                                    <span>{file.name}</span>
                                    <small>{file.extension.toUpperCase()}</small>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="move-destination-section">
                        <label>Destination folder</label>

                        <button
                            className={`move-destination-button ${destination ? "selected" : ""
                                }`}
                            onClick={chooseDestination}
                            disabled={isMoving}
                        >
                            <FolderOpen size={19} />

                            <span>
                                <strong>
                                    {destination
                                        ? getFileName(destination)
                                        : "Choose destination"}
                                </strong>

                                <small>
                                    {destination || "Select a folder on your Mac"}
                                </small>
                            </span>

                            <FolderInput size={16} />
                        </button>
                    </div>

                    {moveError && (
                        <div className="move-error">
                            <AlertCircle size={15} />
                            <span>{moveError}</span>
                        </div>
                    )}

                    {moveResults.length > 0 && (
                        <div className="move-result-section">
                            <div className="move-result-summary">
                                <CheckCircle2 size={16} />
                                <strong>
                                    {isMoving ? "Moving files..." : "Move completed"}
                                </strong>
                            </div>

                            <div className="move-result-counts">
                                <span>{successCount} moved</span>
                                <span>{skippedCount} skipped</span>
                                <span>{failedCount} failed</span>
                            </div>

                            <div className="move-result-list">
                                {moveResults.map((result, index) => (
                                    <div
                                        className={`move-result-item ${result.status}`}
                                        key={`${result.source_path}-${index}`}
                                    >
                                        <div className="move-result-info">
                                            <span>{getFileName(result.source_path)}</span>
                                            {/* <small>{result.status}</small> */}

                                            {result.message && (
                                                <small className="move-result-message">
                                                    {result.message}
                                                </small>
                                            )}
                                        </div>

                                        {result.status === "success" && (
                                            <button
                                                className="move-show-in-finder-button"
                                                onClick={() =>
                                                    handleReveal(result.destination_path)
                                                }
                                                title="Show in Finder"
                                            >
                                                <ExternalLink size={13} />
                                                <span>Show in Finder</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        className="merge-button move-button"
                        onClick={onMove}
                        disabled={!canMove || isMoving}
                    >
                        {isMoving ? "Moving..." : "Move Files"}
                        {!isMoving && <FolderInput size={16} />}
                    </button>
                </motion.section>
            )}
        </AnimatePresence>
    );
}
