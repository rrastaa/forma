
import { AnimatePresence, motion } from "motion/react";
import { Combine } from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import type { SelectedFile } from "../../types/file";
import { SortableFileItem } from "./sortableFileItem";

type SelectedFilesProps = {
  selectedFiles: SelectedFile[];
  onReorder: (files: SelectedFile[]) => void;
};

export function SelectedFiles({
  selectedFiles,
  onReorder,
}: SelectedFilesProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (
    activeId: string | number,
    overId?: string | number
  ) => {
    if (!overId || activeId === overId) return;

    const oldIndex = selectedFiles.findIndex(
      (file) => file.path === activeId
    );

    const newIndex = selectedFiles.findIndex(
      (file) => file.path === overId
    );

    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(selectedFiles, oldIndex, newIndex));
  };

  return (
    <AnimatePresence>
      {selectedFiles.length > 1 && (
        <motion.section
          key="selected-files"
          className="stack-panel selected-files-panel"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          <div className="panel-heading">
            <div>
              <strong>Selected files</strong>
              <span>
                {selectedFiles.length} items · Drag to reorder
              </span>
            </div>

            <Combine size={17} />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              handleDragEnd(active.id, over?.id);
            }}
          >
            <SortableContext
              items={selectedFiles.map((file) => file.path)}
              strategy={verticalListSortingStrategy}
            >
              <div className="selected-files-list">
                {selectedFiles.map((file, index) => (
                  <SortableFileItem
                    key={file.path}
                    file={file}
                    index={index}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
