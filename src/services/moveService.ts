
import { invoke } from "@tauri-apps/api/core";
import { open, message } from "@tauri-apps/plugin-dialog";

export type MoveConflictAction =
  | "ask"
  | "skip"
  | "replace"
  | "keep_both";

export type MoveResult = {
  source_path: string;
  destination_path: string;
  status: "success" | "skipped" | "failed" | "conflict";
  message: string;
};

export async function selectDestinationFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose Destination Folder",
  });

  return typeof selected === "string" ? selected : null;
}

export async function askMoveConflict(
  filename: string
): Promise<MoveConflictAction> {
  const result = await message(
    `"${filename}" already exists in the destination folder.`,
    {
      title: "File Already Exists",
      kind: "warning",
      buttons: {
        yes: "Replace",
        no: "Keep Both",
        cancel: "Skip",
      },
    }
  );

  if (result === "Replace") return "replace";
  if (result === "Keep Both") return "keep_both";

  return "skip";
}

export async function moveFiles(
  inputPaths: string[],
  destination: string,
  conflictAction: MoveConflictAction
): Promise<MoveResult[]> {
  return invoke<MoveResult[]>("move_files", {
    inputPaths,
    destination,
    conflictAction,
  });
}
