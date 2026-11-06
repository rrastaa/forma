import {
  ArrowLeftRight,
  Combine,
  Scissors,
  Minimize2,
  FolderInput,
  RotateCw,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

export type OperationName =
  | "Convert"
  | "Merge"
  | "Split"
  | "Compress"
  | "Move"
  | "Transform";

export type ProgressData = {
  current: number;
  total: number;
  percentage: number;
  message: string;
};

export type OperationDefinition = {
  name: OperationName;
  icon: LucideIcon;
};

export const operations: OperationDefinition[] = [
  { name: "Convert", icon: ArrowLeftRight },
  { name: "Merge", icon: Combine },
  { name: "Split", icon: Scissors },
  { name: "Compress", icon: Minimize2 },
  { name: "Move", icon: FolderInput },
  // { name: "Transform", icon: RotateCw },
];