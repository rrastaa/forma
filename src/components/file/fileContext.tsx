
import { AnimatePresence, motion } from "motion/react";
import { File, X } from "lucide-react";

import type { SelectedFile } from "../../types/file";
import { getFileIcon } from "../../utils/fileUtils";

type FileContextProps = {
  selectedFiles: SelectedFile[];
  onClose: () => void;
};

export function FileContext({
  selectedFiles,
  onClose,
}: FileContextProps) {
  const selectedFile = selectedFiles[0] ?? null;

  const FileIcon = selectedFile
    ? getFileIcon(selectedFile.extension)
    : File;

  return (
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
          onClick={onClose}
          title="Close Forma"
        >
          <X size={18} />
        </button>
      </motion.section>
    </AnimatePresence>
  );
}
