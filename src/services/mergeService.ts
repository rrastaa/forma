
import { invoke } from "@tauri-apps/api/core";

export async function mergePdf(inputPaths: string[]): Promise<string> {
  return invoke<string>("merge_pdf", {
    inputPaths,
  });
}
