
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { getFileIcon } from "../../utils/fileUtils";
import type { SelectedFile } from "../../types/file";

type SortableFileItemProps = {
  file: SelectedFile;
  index: number;
};

export function SortableFileItem({
  file,
  index,
}: SortableFileItemProps) {
  const Icon = getFileIcon(file.extension);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: file.path,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 2 : 0,
    position: "relative" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="selected-file-item"
      {...attributes}
      {...listeners}
    >
      <span className="file-order">{index + 1}</span>
      <Icon size={17} />
      <span className="selected-file-name">{file.name}</span>
      <span className="drag-handle">⠿</span>
    </div>
  );
}
