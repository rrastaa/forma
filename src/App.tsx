import {
  File,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
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
import { FileContext } from "./components/file/fileContext";

import {
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  arrayMove,
} from "@dnd-kit/sortable";


import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  currentMonitor,
  primaryMonitor,
} from "@tauri-apps/api/window";

import { revealInFinder } from "./services/fileService";

import { AnimatePresence, motion } from "motion/react";

import "./App.css";

import { SortableFileItem } from "./components/file/sortableFileItem";
import { SelectedFiles } from "./components/file/selectedFiles";

import { useMerge } from "./features/merge/useMerge";
import { useSplit } from "./features/split/useSplit";

import { ConvertMenu } from "./features/convert/convertMenu";
import { MergeMenu } from "./features/merge/mergeMenu";
import { SplitMenu } from "./features/split/splitMenu";

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

  const {
    isMerging,
    mergeResult,
    mergeError,
    mergeProgress,
    handleMerge,
    resetMerge,
    setMergeErrorMessage,
  } = useMerge(selectedFiles);

  // ==========================================
  // SPLIT STATE
  // ==========================================

  const {
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
    setSplitErrorMessage,
  } = useSplit(selectedFiles);

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
    resetMerge();

    resetSplit();
  }, [resetConversion, resetMerge, resetSplit]);

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

    resetMerge();

    resetSplit();

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
  }, [
    loadSelectedFiles,
    setSelectedFiles,
    resetConversion,
    resetMerge,
  ]);

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





  // ==========================================
  // REVEAL OUTPUT IN FINDER
  // ==========================================

  const handleRevealInFinder = async (path: string) => {
    try {
      await revealInFinder(path);
    } catch (error) {
      console.error("[FORMA] Failed to reveal file:", error);

      if (activeOperation === "Merge") {
        setMergeErrorMessage(String(error));
      } else if (activeOperation === "Split") {
        setSplitErrorMessage(String(error));
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
              <FileContext
                selectedFiles={selectedFiles}
                onClose={closeForma}
              />

              {/* Selected files panel */}
              <SelectedFiles
                selectedFiles={selectedFiles}
                onReorder={setSelectedFiles}
              />

              {/* Convert submenu */}
              <ConvertMenu
                isOpen={activeOperation === "Convert"}
                selectedFile={selectedFile}
                selectedFiles={selectedFiles}
                isConverting={isConverting}
                handleConvert={handleConvert}
                onBack={resetOperation}
              />

              {/* Merge submenu */}
              <MergeMenu
                isOpen={activeOperation === "Merge"}
                selectedFiles={selectedFiles}
                isMerging={isMerging}
                canMerge={canMerge}
                onMerge={handleMerge}
                onBack={resetOperation}
              />

              {/* Split submenu */}
              <SplitMenu
                isOpen={activeOperation === "Split"}
                splitMode={splitMode}
                setSplitMode={setSplitMode}
                pageRanges={pageRanges}
                setPageRanges={setPageRanges}
                isSplitting={isSplitting}
                canSplit={canSplit}
                onSplit={handleSplit}
                onResetSplit={resetSplit}
                onBack={resetOperation}
              />

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
                      className={`operation-button ${isActive ? "active" : ""
                        } ${!isAvailable ? "disabled" : ""}`}
                      disabled={!isAvailable}
                      onClick={() => {
                        setActiveOperation(
                          activeOperation === operation.name
                            ? null
                            : operation.name
                        );

                        resetConversion();
                        resetMerge();

                        resetSplit();
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
