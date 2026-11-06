import { useCallback, useEffect, useState } from "react";
import type { SelectedFile } from "../../types/file";
import {
    estimatePdfCompression,
    compressPdf,
    type CompressionEstimate,
    type CompressionPreset,
} from "../../services/compressService";

export function useCompress(selectedFiles: SelectedFile[]) {
    const [estimates, setEstimates] = useState<CompressionEstimate[]>([]);
    const [selectedPreset, setSelectedPreset] =
        useState<CompressionPreset>("balanced");

    const [isEstimating, setIsEstimating] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);

    const [compressionResult, setCompressionResult] =
        useState<string | null>(null);
    const [compressionError, setCompressionError] =
        useState<string | null>(null);

    const selectedFile = selectedFiles[0];

    const loadEstimates = useCallback(async () => {
        if (!selectedFile || selectedFile.extension.toLowerCase() !== "pdf") {
            setEstimates([]);
            return;
        }

        setIsEstimating(true);
        setCompressionError(null);
        setCompressionResult(null);

        try {
            const result = await estimatePdfCompression(selectedFile.path);
            setEstimates(result);
        } catch (error) {
            setCompressionError(String(error));
            setEstimates([]);
        } finally {
            setIsEstimating(false);
        }
    }, [selectedFile]);

    useEffect(() => {
        void loadEstimates();
    }, [loadEstimates]);

    const handleCompress = useCallback(async () => {
        if (!selectedFile || selectedFiles.length !== 1) return;

        setIsCompressing(true);
        setCompressionError(null);
        setCompressionResult(null);

        try {
            const result = await compressPdf(
                selectedFile.path,
                selectedPreset
            );

            setCompressionResult(result);
        } catch (error) {
            setCompressionError(String(error));
        } finally {
            setIsCompressing(false);
        }
    }, [selectedFile, selectedFiles.length, selectedPreset]);

    const resetCompression = useCallback(() => {
        setCompressionResult(null);
        setCompressionError(null);
    }, []);

    return {
        estimates,
        selectedPreset,
        setSelectedPreset,
        isEstimating,
        isCompressing,
        compressionResult,
        compressionError,
        handleCompress,
        loadEstimates,
        resetCompression,
    };
}
