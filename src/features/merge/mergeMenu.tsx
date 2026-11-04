import { AnimatePresence, motion } from "motion/react";
import { FileText, Combine } from "lucide-react";

import type { SelectedFile } from "../../types/file";

type MergeMenuProps = {
  isOpen: boolean;
  selectedFiles: SelectedFile[];
  isMerging: boolean;
  canMerge: boolean;
  onMerge: () => void;
  onBack: () => void;
};

export function MergeMenu({
  isOpen,
  selectedFiles,
  isMerging,
  canMerge,
  onMerge,
  onBack,
}: MergeMenuProps) {
  return (
    <AnimatePresence mode="popLayout">
      {isOpen && (
        <motion.section
          key="merge-menu"
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
              <strong>Merge PDF</strong>
              <span>
                Combine selected PDF files into one document
              </span>
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
            onClick={onMerge}
            disabled={isMerging || !canMerge}
          >
            {isMerging ? "Merging..." : "Merge PDF"}
            {!isMerging && <Combine size={16} />}
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
