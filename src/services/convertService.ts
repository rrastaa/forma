
import { invoke } from "@tauri-apps/api/core";

export type ConversionFormat = "png" | "jpg" | "pdf";

export async function convertPdf(
  inputPath: string,
  outputFormat: Exclude<ConversionFormat, "pdf">
): Promise<string[]> {
  return invoke<string[]>("convert_pdf", {
    inputPath,
    outputFormat,
  });
}

export async function convertImageToPdf(
  inputPath: string
): Promise<string[]> {
  return invoke<string[]>("convert_image_to_pdf", {
    inputPath,
  });
}
