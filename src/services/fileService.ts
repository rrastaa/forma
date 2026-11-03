
import { invoke } from "@tauri-apps/api/core";
import type { SelectedFile } from "../types/file";

export async function getSelectedFinderFiles(): Promise<SelectedFile[]> {
  return invoke<SelectedFile[]>("get_selected_finder_file");
}

export async function revealInFinder(path: string): Promise<void> {
  return invoke("reveal_in_finder", { path });
}
