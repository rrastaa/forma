
import { invoke } from "@tauri-apps/api/core";

export type ConversionFormat = "png" | "jpg" | "pdf" | "docx";

export async function convertPdf(
    inputPath: string,
    outputFormat: "png" | "jpg"
): Promise<string[]> {
    return invoke<string[]>("convert_pdf", { inputPath, outputFormat });
}

export async function convertPdfToDocx(
    inputPath: string
): Promise<string[]> {
    return invoke<string[]>("convert_pdf_to_docx", { inputPath });
}

export async function convertImageToPdf(inputPath: string): Promise<string[]> {
    return invoke<string[]>("convert_image_to_pdf", { inputPath });
}

export async function convertImage(
    inputPath: string,
    outputFormat: "png" | "jpg"
): Promise<string[]> {
    return invoke<string[]>("convert_image", { inputPath, outputFormat });
}

export async function convertDocxToPdf(inputPath: string): Promise<string[]> {
    return invoke<string[]>("convert_docx_to_pdf", { inputPath });
}
