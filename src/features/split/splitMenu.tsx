
import { AnimatePresence, motion } from "motion/react";
import { Scissors, FileText } from "lucide-react";

import type { SplitMode } from "../../services/splitService";

type SplitMenuProps = {
  isOpen: boolean;
  splitMode: SplitMode;
  setSplitMode: (mode: SplitMode) => void;
  pageRanges: string;
  setPageRanges: (ranges: string) => void;
  isSplitting: boolean;
  canSplit: boolean;
  onSplit: () => void;
  onResetSplit: () => void;
  onBack: () => void;
};

export function SplitMenu({
  isOpen,
  splitMode,
  setSplitMode,
  pageRanges,
  setPageRanges,
  isSplitting,
  canSplit,
  onSplit,
  onResetSplit,
  onBack,
}: SplitMenuProps) {
  return (
    <AnimatePresence mode="popLayout">
      {isOpen && (
        <motion.section
          key="split-menu"
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
                onResetSplit();
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
                onResetSplit();
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
                onChange={(event) => setPageRanges(event.target.value)}
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
            onClick={onSplit}
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
  );
}
