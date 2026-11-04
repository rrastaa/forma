import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type ProgressPanelProps = {
  isVisible: boolean;
  panelKey: string;
  message: string;
  percentage: number;
  detail?: string;
};

export function ProgressPanel({
  isVisible,
  panelKey,
  message,
  percentage,
  detail,
}: ProgressPanelProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.section
          key={panelKey}
          className="stack-panel status-panel progress-panel"
          initial={{ opacity: 0, y: 22, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22 }}
        >
          <div className="status-heading">
            <LoaderCircle className="spin-icon" size={18} />
            <strong>{message}</strong>
            <span>{percentage}%</span>
          </div>

          <div className="progress-track">
            <motion.div
              className="progress-fill"
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          {detail && (
            <span className="progress-pages">{detail}</span>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
