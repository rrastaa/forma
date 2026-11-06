
import { invoke } from "@tauri-apps/api/core";

export type CompressionPreset = "smallest" | "balanced" | "high";

export type CompressionEstimate = {
    preset: CompressionPreset;
    original_size: number;
    estimated_size: number;
    reduction_percent: number;
};

export async function estimatePdfCompression(
    inputPath: string
): Promise<CompressionEstimate[]> {
    return invoke<CompressionEstimate[]>(
        "estimate_pdf_compression",
        { inputPath }
    );
}

export async function compressPdf(
    inputPath: string,
    preset: CompressionPreset
): Promise<string> {
    return invoke<string>("compress_pdf", {
        inputPath,
        preset,
    });
}
