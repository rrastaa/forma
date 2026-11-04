import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type ErrorPanelProps = {
  isVisible: boolean;
  panelKey: string;
  title: string;
  message: string;
};

export function ErrorPanel({
  isVisible,
  panelKey,
  title,
  message,
}: ErrorPanelProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.section
          key={panelKey}
          className="stack-panel status-panel error-panel"
          initial={{ opacity: 0, y: 22, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22 }}
        >
          <div className="status-heading">
            <AlertCircle size={18} />
            <strong>{title}</strong>
          </div>

          <span className="status-description">{message}</span>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
