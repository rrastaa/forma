
import { invoke } from "@tauri-apps/api/core";

export type SplitMode = "range" | "all";

export async function splitPdf(
  inputPath: string,
  mode: SplitMode,
  pageRanges: string | null
): Promise<string[]> {
  return invoke<string[]>("split_pdf", {
    inputPath,
    mode,
    pageRanges,
  });
}
