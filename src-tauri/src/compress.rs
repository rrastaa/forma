
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone, Serialize)]
pub struct CompressionEstimate {
    pub preset: String,
    pub original_size: u64,
    pub estimated_size: u64,
    pub reduction_percent: f64,
}

fn get_ghostscript_path() -> &'static str {
    if Path::new("/opt/homebrew/bin/gs").exists() {
        "/opt/homebrew/bin/gs"
    } else {
        "gs"
    }
}

fn validate_pdf(input_path: &str) -> Result<&Path, String> {
    let input = Path::new(input_path);

    if !input.exists() || !input.is_file() {
        return Err("Source PDF does not exist.".to_string());
    }

    if input.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf")) != Some(true)
    {
        return Err("Only PDF files are supported.".to_string());
    }

    Ok(input)
}

fn get_preset(preset: &str) -> Result<&'static str, String> {
    match preset {
        "smallest" => Ok("/screen"),
        "balanced" => Ok("/ebook"),
        "high" => Ok("/prepress"),
        _ => Err("Unsupported compression preset.".to_string()),
    }
}

fn run_ghostscript(
    input_path: &Path,
    output_path: &Path,
    preset: &str,
) -> Result<(), String> {
    let settings = get_preset(preset)?;
    let output_argument = format!(
        "-sOutputFile={}",
        output_path.to_string_lossy()
    );

    let output = Command::new(get_ghostscript_path())
        .arg("-sDEVICE=pdfwrite")
        .arg("-dCompatibilityLevel=1.4")
        .arg(format!("-dPDFSETTINGS={}", settings))
        .arg("-dNOPAUSE")
        .arg("-dQUIET")
        .arg("-dBATCH")
        .arg(&output_argument)
        .arg(input_path)
        .output()
        .map_err(|e| format!("Failed to execute Ghostscript: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "PDF compression failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    if !output_path.exists() {
        return Err("Compressed PDF was not generated.".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn estimate_pdf_compression(
    input_path: String,
) -> Result<Vec<CompressionEstimate>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let input = validate_pdf(&input_path)?;
        let original_size = fs::metadata(input)
            .map_err(|e| format!("Failed to read PDF metadata: {e}"))?
            .len();

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();

        let temp_dir = std::env::temp_dir().join(format!(
            "forma-compress-{}-{}",
            std::process::id(),
            timestamp
        ));

        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temporary folder: {e}"))?;

        let result = (|| {
            let presets = ["smallest", "balanced", "high"];
            let mut estimates = Vec::new();

            for preset in presets {
                let output_path = temp_dir.join(format!("{preset}.pdf"));

                run_ghostscript(input, &output_path, preset)?;

                let estimated_size = fs::metadata(&output_path)
                    .map_err(|e| format!("Failed to inspect compressed PDF: {e}"))?
                    .len();

                let reduction_percent = if original_size == 0 {
                    0.0
                } else {
                    (1.0 - estimated_size as f64 / original_size as f64) * 100.0
                };

                estimates.push(CompressionEstimate {
                    preset: preset.to_string(),
                    original_size,
                    estimated_size,
                    reduction_percent,
                });
            }

            Ok(estimates)
        })();

        let _ = fs::remove_dir_all(&temp_dir);

        result
    })
    .await
    .map_err(|e| format!("Estimate task failed: {e}"))?
}

#[tauri::command]
pub async fn compress_pdf(
    input_path: String,
    preset: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let input = validate_pdf(&input_path)?;
        get_preset(&preset)?;

        let parent = input.parent()
            .ok_or("Cannot determine source directory.")?;

        let stem = input.file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("document");

        let mut output_path = parent.join(format!("{stem}-compressed.pdf"));
        let mut counter = 2;

        while output_path.exists() {
            output_path = parent.join(format!("{stem}-compressed-{counter}.pdf"));
            counter += 1;
        }

        run_ghostscript(input, &output_path, &preset)?;

        Ok(output_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("Compression task failed: {e}"))?
}
