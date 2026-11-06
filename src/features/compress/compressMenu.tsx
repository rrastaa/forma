import { AnimatePresence, motion } from "motion/react";
import { Minimize2, Scale, Sparkles } from "lucide-react";

import type { SelectedFile } from "../../types/file";
import type {
    CompressionEstimate,
    CompressionPreset,
} from "../../services/compressService";

type CompressMenuProps = {
    isOpen: boolean;
    selectedFile: SelectedFile | null;
    selectedFiles: SelectedFile[];
    estimates: CompressionEstimate[];
    selectedPreset: CompressionPreset;
    setSelectedPreset: (preset: CompressionPreset) => void;
    isEstimating: boolean;
    isCompressing: boolean;
    handleCompress: () => void;
    compressionError: string | null;
    onBack: () => void;
};

const presets = [
    {
        id: "smallest",
        name: "Smallest",
        description: "Maximum compression, smaller file size",
        icon: Minimize2,
    },
    {
        id: "balanced",
        name: "Balanced",
        description: "A balance between size and quality",
        icon: Scale,
    },
    {
        id: "high",
        name: "High Quality",
        description: "Preserve more visual quality",
        icon: Sparkles,
    },
] as const;

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;

    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function CompressMenu({
    isOpen,
    selectedFile,
    selectedFiles,
    estimates,
    selectedPreset,
    setSelectedPreset,
    isEstimating,
    isCompressing,
    handleCompress,
    compressionError,
    onBack,
}: CompressMenuProps) {
    const isValidSelection =
        selectedFile?.extension.toLowerCase() === "pdf" &&
        selectedFiles.length === 1;

    return (
        <AnimatePresence mode="popLayout">
            {isOpen && (
                <motion.section
                    key="compress-menu"
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
                            <strong>Compress PDF</strong>
                            <span>Choose your preferred compression level</span>
                        </div>
                    </div>

                    <div className="compression-list">
                        {presets.map((preset) => {
                            const Icon = preset.icon;
                            const estimate = estimates.find(
                                (item) => item.preset === preset.id
                            );

                            const isSelected = selectedPreset === preset.id;

                            return (
                                <button
                                    key={preset.id}
                                    className={`compression-option ${
                                        isSelected ? "selected" : ""
                                    }`}
                                    disabled={
                                        isEstimating ||
                                        isCompressing ||
                                        !isValidSelection
                                    }
                                    onClick={() =>
                                        setSelectedPreset(preset.id)
                                    }
                                >
                                    <Icon size={21} />

                                    <span className="compression-info">
                                        <strong>{preset.name}</strong>
                                        <small>{preset.description}</small>
                                    </span>

                                    <span className="compression-estimate">
                                        {isEstimating ? (
                                            <small>Calculating...</small>
                                        ) : estimate ? (
                                            <>
                                                <strong>
                                                    {formatFileSize(
                                                        estimate.estimated_size
                                                    )}
                                                </strong>
                                                <small>
                                                    {estimate.reduction_percent >= 0
                                                        ? `${estimate.reduction_percent.toFixed(1)}% smaller`
                                                        : `${Math.abs(estimate.reduction_percent).toFixed(1)}% larger`}
                                                </small>
                                            </>
                                        ) : (
                                            <small>Unavailable</small>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {compressionError && (
                        <p className="compression-error">
                            {compressionError}
                        </p>
                    )}

                    <button
                        className="compress-action-button"
                        disabled={
                            isEstimating ||
                            isCompressing ||
                            !estimates.some(
                                (item) => item.preset === selectedPreset
                            ) ||
                            !isValidSelection
                        }
                        onClick={handleCompress}
                    >
                        {isCompressing
                            ? "Compressing..."
                            : "Compress PDF"}
                    </button>
                </motion.section>
            )}
        </AnimatePresence>
    );
}
