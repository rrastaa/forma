
import { AnimatePresence, motion } from "motion/react";
import { FileImage, FileText } from "lucide-react";

import type { SelectedFile } from "../../types/file";
import type { ConversionFormat } from "../../services/convertService";

type ConvertMenuProps = {
  isOpen: boolean;
  selectedFile: SelectedFile | null;
  selectedFiles: SelectedFile[];
  isConverting: boolean;
  handleConvert: (format: ConversionFormat) => void;
  onBack: () => void;
};

export function ConvertMenu({
  isOpen,
  selectedFile,
  selectedFiles,
  isConverting,
  handleConvert,
  onBack,
}: ConvertMenuProps) {
  const isPdf = selectedFile?.extension.toLowerCase() === "pdf";

  return (
    <AnimatePresence mode="popLayout">
      {isOpen && (
        <motion.section
          key="convert-menu"
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
              <strong>
                {isPdf ? "Convert PDF" : "Convert Image"}
              </strong>

              <span>
                {isPdf
                  ? "Choose your output format"
                  : "Convert your image into PDF"}
              </span>
            </div>
          </div>

          <div className="format-list">
            {isPdf ? (
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
  );
}
