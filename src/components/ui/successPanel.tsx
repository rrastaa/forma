import { CheckCircle2, File } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type SuccessPanelProps = {
    isVisible: boolean;
    panelKey: string;
    title: string;
    description: string;
    outputFiles?: string[];
    onReveal: (path: string) => void;
    revealPath?: string;
};

function getFileName(path: string) {
    return path.split("/").pop() ?? path;
}

export function SuccessPanel({
    isVisible,
    panelKey,
    title,
    description,
    outputFiles,
    onReveal,
    revealPath,
}: SuccessPanelProps) {
    const firstFile = revealPath ?? outputFiles?.[0];

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.section
                    key={panelKey}
                    className="stack-panel status-panel success-panel"
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                >
                    <div className="success-content">
                        <div className="status-heading">
                            <CheckCircle2 size={18} />
                            <strong>{title}</strong>
                        </div>

                        <span className="status-description">{description}</span>

                        {outputFiles && (
                            <div className="result-files">
                                {outputFiles.slice(0, 3).map((path) => (
                                    <span key={path}>{getFileName(path)}</span>
                                ))}

                                {outputFiles.length > 3 && (
                                    <span>+{outputFiles.length - 3} more files</span>
                                )}
                            </div>
                        )}
                    </div>

                    {firstFile && (
                        <button
                            className="reveal-button"
                            onClick={() => onReveal(firstFile)}
                            
                        >
                            <File size={14} />
                            Show in Finder
                        </button>
                    )}
                </motion.section>
            )}
        </AnimatePresence>
    );
}
