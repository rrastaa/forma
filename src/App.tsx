
import type { SelectedFile } from "./types/file";
import { operations } from "./types/operation";

import { getAvailableOperations } from "./utils/fileUtils";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSelectedFiles } from "./hooks/useSelectedFiles";
import { useFinderShortcut } from "./hooks/useFinderShortcut";

import { useConvert } from "./hooks/useConvert";
import { useMerge } from "./features/merge/useMerge";
import { useSplit } from "./features/split/useSplit";

import { FileContext } from "./components/file/fileContext";
import { SelectedFiles } from "./components/file/selectedFiles";

import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  currentMonitor,
  primaryMonitor,
} from "@tauri-apps/api/window";

import { revealInFinder } from "./services/fileService";

import { AnimatePresence, motion } from "motion/react";

import { ConvertMenu } from "./features/convert/convertMenu";
import { MergeMenu } from "./features/merge/mergeMenu";
import { SplitMenu } from "./features/split/splitMenu";

import { ProgressPanel } from "./components/ui/progressPanel";
import { ErrorPanel } from "./components/ui/errorPanel";
import { SuccessPanel } from "./components/ui/successPanel";

import "./App.css";

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
    resetSplit,
    setSplitMode,
    setPageRanges,
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
              <ProgressPanel
                isVisible={activeOperation === "Convert" && isConverting}
                panelKey="conversion-progress"
                message={conversionProgress.message}
                percentage={conversionProgress.percentage}
                detail={`${conversionProgress.current} of ${conversionProgress.total} pages`}
              />

              {/* Conversion error panel */}
              <ErrorPanel
                isVisible={activeOperation === "Convert" && !!conversionError}
                panelKey="conversion-error"
                title="Conversion failed"
                message={conversionError ?? ""}
              />

              {/* Conversion success panel */}
              <SuccessPanel
                isVisible={activeOperation === "Convert" && !!conversionResult}
                panelKey="conversion-success"
                title="Conversion completed!"
                description={`${conversionResult?.length ?? 0} file(s) successfully generated.`}
                outputFiles={conversionResult ?? undefined}
                onReveal={handleRevealInFinder}
              />

              {/* Merge progress panel */}
              <ProgressPanel
                isVisible={activeOperation === "Merge" && isMerging}
                panelKey="merge-progress"
                message={mergeProgress.message}
                percentage={mergeProgress.percentage}
              />

              {/* Merge error panel */}
              <ErrorPanel
                isVisible={activeOperation === "Merge" && !!mergeError}
                panelKey="merge-error"
                title="Merge failed"
                message={mergeError ?? ""}
              />

              {/* Merge success panel */}
              <SuccessPanel
                isVisible={activeOperation === "Merge" && !!mergeResult}
                panelKey="merge-success"
                title="PDF successfully merged!"
                description={mergeResult?.split("/").pop() ?? ""}
                onReveal={handleRevealInFinder}
                revealPath={mergeResult ?? undefined}
              />
            </div>

            {/* Split progress panel */}
            <ProgressPanel
              isVisible={activeOperation === "Split" && isSplitting}
              panelKey="split-progress"
              message={splitProgress.message}
              percentage={splitProgress.percentage}
              detail={`${splitProgress.current} of ${splitProgress.total} completed`}
            />

            {/* Split error panel */}
            <ErrorPanel
              isVisible={activeOperation === "Split" && !!splitError}
              panelKey="split-error"
              title="Split failed"
              message={splitError ?? ""}
            />

            {/* Split success panel */}
            <SuccessPanel
              isVisible={activeOperation === "Split" && !!splitResult}
              panelKey="split-success"
              title="PDF successfully split!"
              description={`${splitResult?.length ?? 0} PDF file(s) generated.`}
              outputFiles={splitResult ?? undefined}
              onReveal={handleRevealInFinder}
            />

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
