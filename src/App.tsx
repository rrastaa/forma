
import {
  File,
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Combine,
  FileImage,
  FileText,
  Scissors,
} from "lucide-react";

import type { SelectedFile } from "./types/file";
import {
  operations,
  type ProgressData,
} from "./types/operation";

import {
  getFileIcon,
  getAvailableOperations,
} from "./utils/fileUtils";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSelectedFiles } from "./hooks/useSelectedFiles";
import { useFinderShortcut } from "./hooks/useFinderShortcut";
import { useConvert } from "./hooks/useConvert";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  currentMonitor,
  primaryMonitor,
} from "@tauri-apps/api/window";

import { revealInFinder } from "./services/fileService";
import { mergePdf } from "./services/mergeService";
import { splitPdf } from "./services/splitService";

import { AnimatePresence, motion } from "motion/react";
import { listen } from "@tauri-apps/api/event";

import "./App.css";

function SortableFileItem({
  file,
  index,
}: {
  file: SelectedFile;
  index: number;
}) {
  const Icon = getFileIcon(file.extension);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: file.path,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 2 : 0,
    position: "relative" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="selected-file-item"
      {...attributes}
      {...listeners}
    >
      <span className="file-order">{index + 1}</span>
      <Icon size={17} />
      <span className="selected-file-name">{file.name}</span>
      <span className="drag-handle">⠿</span>
    </div>
  );
}

function App() {
  console.log("[DEBUG] App component rendered");

  // ==========================================
  // FILE STATE
  // ==========================================

  const {
    selectedFiles,
    setSelectedFiles,
    loadSelectedFiles,
  } = useSelectedFiles();

  const selectedFilesRef = useRef<SelectedFile[]>([]);
  const selectedFile = selectedFiles[0] ?? null;

  // ==========================================
  // GENERAL UI STATE
  // ==========================================

  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // ==========================================
  // CONVERSION
  // ==========================================

  const {
    isConverting,
    conversionResult,
    conversionError,
    conversionProgress,
    handleConvert,
    resetConversion,
  } = useConvert(selectedFiles);

  // ==========================================
  // MERGE STATE
  // ==========================================

  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const [mergeProgress, setMergeProgress] = useState<ProgressData>({
    current: 0,
    total: 0,
    percentage: 0,
    message: "Preparing merge...",
  });

  // ==========================================
  // SPLIT STATE
  // ==========================================

  const [isSplitting, setIsSplitting] = useState(false);
  const [splitResult, setSplitResult] = useState<string[] | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  const [splitMode, setSplitMode] = useState<"range" | "all">("range");
  const [pageRanges, setPageRanges] = useState("");

  const [splitProgress, setSplitProgress] = useState<ProgressData>({
    current: 0,
    total: 0,
    percentage: 0,
    message: "Preparing PDF split...",
  });

  // ==========================================
  // DERIVED VALUES
  // ==========================================

  const availableOperations = selectedFile
    ? getAvailableOperations(selectedFile.extension)
    : [];

  const canMerge =
    selectedFiles.length >= 2 &&
    selectedFiles.every(
      (file) => file.extension.toLowerCase() === "pdf"
    );

  const canSplit =
    selectedFiles.length === 1 &&
    selectedFile?.extension.toLowerCase() === "pdf";

  const FileIcon = selectedFile
    ? getFileIcon(selectedFile.extension)
    : File;

  // ==========================================
  // RESET OPERATION
  // ==========================================

  const resetOperation = useCallback(() => {
    setActiveOperation(null);

    resetConversion();

    setMergeResult(null);
    setMergeError(null);

    setSplitResult(null);
    setSplitError(null);
  }, [resetConversion]);

  // ==========================================
  // SHOW FORMA
  // ==========================================

  const showForma = useCallback(async () => {
    console.log("[DEBUG] showForma called");

    const files = await loadSelectedFiles();

    if (files.length === 0) {
      console.log("[FORMA] No files selected");
      return;
    }

    console.log("[FORMA] Finder files:", files);

    setSelectedFiles(files);
    setActiveOperation(null);

    resetConversion();

    setMergeResult(null);
    setMergeError(null);

    setSplitResult(null);
    setSplitError(null);

    setSplitMode("range");
    setPageRanges("");

    const appWindow = getCurrentWindow();
    const monitor =
      (await currentMonitor()) ?? (await primaryMonitor());

    if (monitor) {
      const width = 1080;
      const height = 420;
      const scale = monitor.scaleFactor;

      await appWindow.setSize(new LogicalSize(width, height));

      const x =
        monitor.position.x +
        (monitor.size.width - width * scale) / 2;

      const y =
        monitor.position.y +
        monitor.size.height -
        height * scale -
        48 * scale -
        50;

      await appWindow.setPosition(new PhysicalPosition(x, y));
    }

    await appWindow.show();
    await appWindow.setFocus();

    setIsVisible(true);
  }, [loadSelectedFiles, setSelectedFiles, resetConversion]);

  // ==========================================
  // FINDER SHORTCUT
  // ==========================================

  console.log("[DEBUG] Before finder shortcut");

  useFinderShortcut(showForma);

  console.log("[DEBUG] After finder shortcut");

  // ==========================================
  // SELECTED FILES REF
  // ==========================================

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  // ==========================================
  // DRAG AND DROP CONFIGURATION
  // ==========================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // ==========================================
  // MERGE PROGRESS LISTENER
  // ==========================================

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

  // ==========================================
  // SPLIT PROGRESS LISTENER
  // ==========================================

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

  // ==========================================
  // KEYBOARD CONTROLS
  // ==========================================

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key === "Escape") {
        setIsVisible(false);
        return;
      }

      const number = Number(event.key);

      if (number >= 1 && number <= 6) {
        const currentFile = selectedFilesRef.current[0];

        const available = currentFile
          ? getAvailableOperations(currentFile.extension)
          : [];

        const operation = available[number - 1];

        if (operation) {
          setActiveOperation(operation);
        }
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  // ==========================================
  // REORDER SELECTED FILES
  // ==========================================

  const handleDragEnd = (
    activeId: string | number,
    overId?: string | number
  ) => {
    if (!overId || activeId === overId) return;

    setSelectedFiles((current) => {
      const oldIndex = current.findIndex(
        (file) => file.path === activeId
      );

      const newIndex = current.findIndex(
        (file) => file.path === overId
      );

      if (oldIndex === -1 || newIndex === -1) return current;

      return arrayMove(current, oldIndex, newIndex);
    });
  };

  // ==========================================
  // MERGE PDF
  // ==========================================

  const handleMerge = async () => {
    if (selectedFiles.length < 2) {
      setMergeError("Select at least 2 PDF files.");
      return;
    }

    if (!canMerge) {
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
  };

  // ==========================================
  // SPLIT PDF
  // ==========================================

  const handleSplit = async () => {
    if (!canSplit || !selectedFile) {
      setSplitError("Select exactly one PDF file to split.");
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
  };

  // ==========================================
  // REVEAL OUTPUT IN FINDER
  // ==========================================

  const handleRevealInFinder = async (path: string) => {
    try {
      await revealInFinder(path);
    } catch (error) {
      console.error("[FORMA] Failed to reveal file:", error);

      if (activeOperation === "Merge") {
        setMergeError(String(error));
      } else if (activeOperation === "Split") {
        setSplitError(String(error));
      } else {
        console.error(
          "[FORMA] Failed to reveal conversion output:",
          error
        );
      }
    }
  };

  // ==========================================
  // CLOSE FORMA
  // ==========================================

  const closeForma = () => {
    setIsVisible(false);
  };

  return (
    <main className="overlay">
      <AnimatePresence
        onExitComplete={() => {
          void getCurrentWindow().hide();
        }}
      >
        {isVisible && (
          <motion.div
            className="forma-layout"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* STACK: all dynamic panels grow upward from the hotbar. */}
            <div className="stack-container">
              {/* File information panel */}
              <AnimatePresence>
                <motion.section
                  key="file-context"
                  className="stack-panel file-context"
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="file-icon">
                    <FileIcon size={23} />
                  </div>

                  <div className="file-information">
                    <span className="file-name">
                      {selectedFiles.length > 1
                        ? `${selectedFiles.length} files selected`
                        : selectedFile?.name ?? "No file selected"}
                    </span>

                    <span className="file-description">
                      {selectedFiles.length > 1
                        ? "Drag files below to change their order"
                        : selectedFile
                          ? `${selectedFile.extension.toUpperCase()} file · Ready to process`
                          : "Select a file in Finder to get started"}
                    </span>
                  </div>

                  <button
                    className="close-button"
                    onClick={closeForma}
                    title="Close Forma"
                  >
                    <X size={18} />
                  </button>
                </motion.section>
              </AnimatePresence>

              {/* Selected files panel */}
              <AnimatePresence>
                {selectedFiles.length > 1 && (
                  <motion.section
                    key="selected-files"
                    className="stack-panel selected-files-panel"
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="panel-heading">
                      <div>
                        <strong>Selected files</strong>
                        <span>{selectedFiles.length} items · Drag to reorder</span>
                      </div>
                      <Combine size={17} />
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={({ active, over }) => {
                        handleDragEnd(active.id, over?.id);
                      }}
                    >
                      <SortableContext
                        items={selectedFiles.map((file) => file.path)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="selected-files-list">
                          {selectedFiles.map((file, index) => (
                            <SortableFileItem
                              key={file.path}
                              file={file}
                              index={index}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Convert submenu */}
              <AnimatePresence mode="popLayout">
                {activeOperation === "Convert" && (
                  <motion.section
                    key="convert-menu"
                    className="stack-panel submenu-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 14, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <div className="submenu-header">
                      <button className="back-button" onClick={resetOperation}>
                        <span>←</span> Back
                      </button>

                      <div>
                        <strong>
                          {selectedFile?.extension.toLowerCase() === "pdf"
                            ? "Convert PDF"
                            : "Convert Image"}
                        </strong>

                        <span>
                          {selectedFile?.extension.toLowerCase() === "pdf"
                            ? "Choose your output format"
                            : "Convert your image into PDF"}
                        </span>
                      </div>
                    </div>

                    <div className="format-list">
                      {selectedFile?.extension.toLowerCase() === "pdf" ? (
                        <>
                          <button
                            className="format-button"
                            disabled={isConverting || selectedFiles.length > 1}
                            onClick={() => handleConvert("png")}
                          >
                            <FileImage size={22} />
                            <span>
                              <strong>PNG</strong>
                              <small>Portable Network Graphics</small>
                            </span>
                            <small>→</small>
                          </button>

                          <button
                            className="format-button"
                            disabled={isConverting || selectedFiles.length > 1}
                            onClick={() => handleConvert("jpg")}
                          >
                            <FileImage size={22} />
                            <span>
                              <strong>JPG</strong>
                              <small>JPEG Image Format</small>
                            </span>
                            <small>→</small>
                          </button>
                        </>
                      ) : (
                        <button
                          className="format-button"
                          disabled={isConverting || selectedFiles.length > 1}
                          onClick={() => handleConvert("pdf")}
                        >
                          <FileText size={22} />
                          <span>
                            <strong>PDF</strong>
                            <small>Portable Document Format</small>
                          </span>
                          <small>→</small>
                        </button>
                      )}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Merge submenu */}
              <AnimatePresence mode="popLayout">
                {activeOperation === "Merge" && (
                  <motion.section
                    key="merge-menu"
                    className="stack-panel submenu-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 14, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <div className="submenu-header">
                      <button className="back-button" onClick={resetOperation}>
                        <span>←</span> Back
                      </button>

                      <div>
                        <strong>Merge PDF</strong>
                        <span>Combine selected PDF files into one document</span>
                      </div>
                    </div>

                    <div className="merge-summary">
                      <div className="merge-file-count">
                        <FileText size={18} />
                        <span>{selectedFiles.length} PDF files selected</span>
                      </div>

                      <p>Files will be merged in the order shown above.</p>
                    </div>

                    <button
                      className="merge-button"
                      onClick={handleMerge}
                      disabled={isMerging || !canMerge}
                    >
                      {isMerging ? "Merging..." : "Merge PDF"}
                      {!isMerging && <Combine size={16} />}
                    </button>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Split submenu */}
              <AnimatePresence mode="popLayout">
                {activeOperation === "Split" && (
                  <motion.section
                    key="split-menu"
                    className="stack-panel submenu-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 14, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <div className="submenu-header">
                      <button className="back-button" onClick={resetOperation}>
                        <span>←</span> Back
                      </button>

                      <div>
                        <strong>Split PDF</strong>
                        <span>Separate your PDF into multiple documents</span>
                      </div>
                    </div>

                    <div className="split-mode-list">
                      <button
                        className={`split-mode-button ${
                          splitMode === "range" ? "active" : ""
                        }`}
                        onClick={() => {
                          setSplitMode("range");
                          setSplitError(null);
                          setSplitResult(null);
                        }}
                      >
                        <Scissors size={19} />
                        <span>
                          <strong>Split by Range</strong>
                          <small>Choose specific pages or page ranges</small>
                        </span>
                      </button>

                      <button
                        className={`split-mode-button ${
                          splitMode === "all" ? "active" : ""
                        }`}
                        onClick={() => {
                          setSplitMode("all");
                          setSplitError(null);
                          setSplitResult(null);
                        }}
                      >
                        <FileText size={19} />
                        <span>
                          <strong>Split All Pages</strong>
                          <small>Save every page as a separate PDF</small>
                        </span>
                      </button>
                    </div>

                    {splitMode === "range" && (
                      <div className="split-range-section">
                        <label htmlFor="page-ranges">Page ranges</label>

                        <input
                          id="page-ranges"
                          className="split-range-input"
                          type="text"
                          value={pageRanges}
                          onChange={(event) =>
                            setPageRanges(event.target.value)
                          }
                          placeholder="e.g. 1-3, 5, 8-10"
                          disabled={isSplitting}
                        />

                        <small>
                          Separate multiple ranges with commas. Each range creates a new PDF.
                        </small>
                      </div>
                    )}

                    <button
                      className="merge-button split-button"
                      onClick={handleSplit}
                      disabled={isSplitting || !canSplit}
                    >
                      {isSplitting
                        ? "Splitting..."
                        : splitMode === "range"
                          ? "Split Selected Pages"
                          : "Split All Pages"}

                      {!isSplitting && <Scissors size={16} />}
                    </button>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Conversion progress panel */}
              <AnimatePresence>
                {activeOperation === "Convert" && isConverting && (
                  <motion.section
                    key="conversion-progress"
                    className="stack-panel status-panel progress-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="status-heading">
                      <LoaderCircle className="spin-icon" size={18} />
                      <strong>{conversionProgress.message}</strong>
                      <span>{conversionProgress.percentage}%</span>
                    </div>

                    <div className="progress-track">
                      <motion.div
                        className="progress-fill"
                        animate={{
                          width: `${conversionProgress.percentage}%`,
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>

                    <span className="progress-pages">
                      {conversionProgress.current} of {conversionProgress.total} pages
                    </span>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Conversion error panel */}
              <AnimatePresence>
                {activeOperation === "Convert" && conversionError && (
                  <motion.section
                    key="conversion-error"
                    className="stack-panel status-panel error-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="status-heading">
                      <AlertCircle size={18} />
                      <strong>Conversion failed</strong>
                    </div>
                    <span className="status-description">{conversionError}</span>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Conversion success panel */}
              <AnimatePresence>
                {activeOperation === "Convert" && conversionResult && (
                  <motion.section
                    key="conversion-success"
                    className="stack-panel status-panel success-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="success-content">
                      <div className="status-heading">
                        <CheckCircle2 size={18} />
                        <strong>Conversion completed!</strong>
                      </div>

                      <span className="status-description">
                        {conversionResult.length} file(s) successfully generated.
                      </span>

                      <div className="result-files">
                        {conversionResult.slice(0, 3).map((path) => (
                          <span key={path}>{path.split("/").pop()}</span>
                        ))}

                        {conversionResult.length > 3 && (
                          <span>+{conversionResult.length - 3} more files</span>
                        )}
                      </div>
                    </div>

                    <button
                      className="reveal-button"
                      onClick={() => handleRevealInFinder(conversionResult[0])}
                    >
                      <File size={14} />
                      Show in Finder
                    </button>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Merge progress panel */}
              <AnimatePresence>
                {activeOperation === "Merge" && isMerging && (
                  <motion.section
                    key="merge-progress"
                    className="stack-panel status-panel progress-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="status-heading">
                      <LoaderCircle className="spin-icon" size={18} />
                      <strong>{mergeProgress.message}</strong>
                      <span>{mergeProgress.percentage}%</span>
                    </div>

                    <div className="progress-track">
                      <motion.div
                        className="progress-fill"
                        animate={{
                          width: `${mergeProgress.percentage}%`,
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Merge error panel */}
              <AnimatePresence>
                {activeOperation === "Merge" && mergeError && (
                  <motion.section
                    key="merge-error"
                    className="stack-panel status-panel error-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="status-heading">
                      <AlertCircle size={18} />
                      <strong>Merge failed</strong>
                    </div>
                    <span className="status-description">{mergeError}</span>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Merge success panel */}
              <AnimatePresence>
                {activeOperation === "Merge" && mergeResult && (
                  <motion.section
                    key="merge-success"
                    className="stack-panel status-panel success-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="success-content">
                      <div className="status-heading">
                        <CheckCircle2 size={18} />
                        <strong>PDF successfully merged!</strong>
                      </div>
                      <span className="status-description">
                        {mergeResult.split("/").pop()}
                      </span>
                    </div>

                    <button
                      className="reveal-button"
                      onClick={() => handleRevealInFinder(mergeResult)}
                    >
                      <File size={14} />
                      Show in Finder
                    </button>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>

            {/* Split progress panel */}
            <AnimatePresence>
              {activeOperation === "Split" && isSplitting && (
                <motion.section
                  key="split-progress"
                  className="stack-panel status-panel progress-panel"
                  initial={{ opacity: 0, y: 22, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="status-heading">
                    <LoaderCircle className="spin-icon" size={18} />
                    <strong>{splitProgress.message}</strong>
                    <span>{splitProgress.percentage}%</span>
                  </div>

                  <div className="progress-track">
                    <motion.div
                      className="progress-fill"
                      animate={{ width: `${splitProgress.percentage}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>

                  <span className="progress-pages">
                    {splitProgress.current} of {splitProgress.total} completed
                  </span>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Split error panel */}
            <AnimatePresence>
              {activeOperation === "Split" && splitError && (
                <motion.section
                  key="split-error"
                  className="stack-panel status-panel error-panel"
                  initial={{ opacity: 0, y: 22, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="status-heading">
                    <AlertCircle size={18} />
                    <strong>Split failed</strong>
                  </div>

                  <span className="status-description">{splitError}</span>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Split success panel */}
            <AnimatePresence>
              {activeOperation === "Split" && splitResult && (
                <motion.section
                  key="split-success"
                  className="stack-panel status-panel success-panel"
                  initial={{ opacity: 0, y: 22, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="success-content">
                    <div className="status-heading">
                      <CheckCircle2 size={18} />
                      <strong>PDF successfully split!</strong>
                    </div>

                    <span className="status-description">
                      {splitResult.length} PDF file(s) generated.
                    </span>

                    <div className="result-files">
                      {splitResult.slice(0, 3).map((path) => (
                        <span key={path}>{path.split("/").pop()}</span>
                      ))}

                      {splitResult.length > 3 && (
                        <span>+{splitResult.length - 3} more files</span>
                      )}
                    </div>
                  </div>

                  <button
                    className="reveal-button"
                    onClick={() => handleRevealInFinder(splitResult[0])}
                  >
                    <File size={14} />
                    Show in Finder
                  </button>
                </motion.section>
              )}
            </AnimatePresence>

            {/* FIXED HOTBAR: always stays at the bottom. */}
            <motion.section
              className="hotbar-shell"
              layout
            >
              {/* <div className="hotbar-brand">
                <span className="brand-mark">F</span>
                <span>FORMA</span>
              </div> */}

              {/* <div className="hotbar-divider" /> */}

              <div className="operation-list">
                {operations.map((operation, index) => {
                  const Icon = operation.icon;

                  const isAvailable =
                    operation.name === "Merge"
                      ? canMerge
                      : operation.name === "Split"
                        ? canSplit
                        : availableOperations.includes(operation.name);

                  const isActive = activeOperation === operation.name;

                  return (
                    <motion.button
                      key={operation.name}
                      className={`operation-button ${
                        isActive ? "active" : ""
                      } ${!isAvailable ? "disabled" : ""}`}
                      disabled={!isAvailable}
                      onClick={() => {
                        setActiveOperation(
                          activeOperation === operation.name
                            ? null
                            : operation.name
                        );

                        resetConversion();

                        setMergeResult(null);
                        setMergeError(null);

                        setSplitResult(null);
                        setSplitError(null);
                      }}
                      whileHover={isAvailable ? { y: -4, scale: 1.04 } : {}}
                      whileTap={isAvailable ? { scale: 0.94 } : {}}
                      title={`${operation.name} · ${index + 1}`}
                    >
                      <Icon size={21} strokeWidth={1.8} />
                      <span>{operation.name}</span>
                      <small>{index + 1}</small>
                    </motion.button>
                  );
                })}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default App;
