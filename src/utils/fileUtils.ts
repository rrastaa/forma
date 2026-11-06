import {
    File,
    FileImage,
    FileText,
  } from "lucide-react";
  
  import type { LucideIcon } from "lucide-react";
  import type { OperationName } from "../types/operation";
  
  export function getFileIcon(extension: string): LucideIcon {
    const ext = extension.toLowerCase();
  
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      return FileImage;
    }
  
    if (["pdf", "doc", "docx", "txt"].includes(ext)) {
      return FileText;
    }
  
    return File;
  }
  
  export function getAvailableOperations(
    extension: string
  ): OperationName[] {
    const ext = extension.toLowerCase();
  
    if (ext === "pdf") {
      return ["Convert", "Merge", "Split", "Compress", "Move"];
    }
  
    if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
      return ["Convert", "Merge", "Compress", "Move", "Transform"];
    }
  
    return ["Convert", "Compress", "Move"];
  }