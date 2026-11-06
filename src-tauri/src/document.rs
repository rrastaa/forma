
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::Emitter;

#[tauri::command]
pub async fn convert_docx_to_pdf(
    app: tauri::AppHandle,
    input_path: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let input = Path::new(&input_path);

        if !input.exists() || !input.is_file() {
            return Err("Input file does not exist.".to_string());
        }

        if input.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_lowercase()) != Some("docx".to_string())
        {
            return Err("Input file must be a DOCX document.".to_string());
        }

        let output_dir = input.parent()
            .ok_or("Invalid input directory.")?;

        let output_name = input.file_stem()
            .and_then(|name| name.to_str())
            .ok_or("Invalid input filename.")?;

        let mut output_path = output_dir.join(format!("{output_name}.pdf"));
        let mut counter = 1;

        while output_path.exists() {
            output_path = output_dir.join(format!("{output_name}-{counter}.pdf"));
            counter += 1;
        }

        let temp_dir = output_dir.join(format!(
            ".forma-temp-{}",
            std::process::id()
        ));

        fs::create_dir(&temp_dir)
            .map_err(|e| format!("Failed to create temporary directory: {e}"))?;

        let conversion_result = (|| {
            let _ = app.emit("conversion-progress", serde_json::json!({
                "current": 0,
                "total": 1,
                "percentage": 10,
                "message": "Converting DOCX to PDF..."
            }));

            let result = Command::new(
                "/Applications/LibreOffice.app/Contents/MacOS/soffice"
            )
                .arg("--headless")
                .arg("--convert-to")
                .arg("pdf")
                .arg("--outdir")
                .arg(&temp_dir)
                .arg(&input_path)
                .output()
                .map_err(|e| format!("Failed to start LibreOffice: {e}"))?;

            if !result.status.success() {
                return Err(format!(
                    "LibreOffice conversion failed: {}",
                    String::from_utf8_lossy(&result.stderr)
                ));
            }

            let generated_path = temp_dir.join(format!("{output_name}.pdf"));

            if !generated_path.exists() {
                return Err("Converted PDF was not generated.".to_string());
            }

            fs::rename(&generated_path, &output_path)
                .map_err(|e| format!("Failed to move output PDF: {e}"))?;

            let _ = app.emit("conversion-progress", serde_json::json!({
                "current": 1,
                "total": 1,
                "percentage": 100,
                "message": "Conversion completed!"
            }));

            Ok(vec![output_path.to_string_lossy().to_string()])
        })();

        let _ = fs::remove_dir_all(&temp_dir);

        conversion_result
    })
    .await
    .map_err(|e| format!("Conversion task failed: {e}"))?
}

#[tauri::command]
pub async fn convert_pdf_to_docx(
    app: tauri::AppHandle,
    input_path: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let input = Path::new(&input_path);

        // Validate input file.
        if !input.exists() || !input.is_file() {
            return Err("Input file does not exist.".to_string());
        }

        if input.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("pdf")) != Some(true)
        {
            return Err("Input file must be a PDF document.".to_string());
        }

        // Determine output directory and filename.
        let output_dir = input.parent()
            .ok_or("Invalid input directory.")?;

        let output_name = input.file_stem()
            .and_then(|name| name.to_str())
            .ok_or("Invalid input filename.")?;

        let mut output_path = output_dir.join(format!("{output_name}.docx"));
        let mut counter = 1;

        while output_path.exists() {
            output_path = output_dir.join(format!("{output_name}-{counter}.docx"));
            counter += 1;
        }

        // Resolve Python environment and converter script.
        let project_root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or("Failed to resolve project directory.")?;

        let python_path = project_root
            .join(".venv-pdf2docx/bin/python");

        let script_path = project_root
            .join("src-tauri/python/pdf_to_docx.py");

        if !python_path.exists() {
            return Err("Python environment not found.".to_string());
        }

        if !script_path.exists() {
            return Err("PDF to DOCX converter script not found.".to_string());
        }

        let _ = app.emit("conversion-progress", serde_json::json!({
            "current": 0,
            "total": 1,
            "percentage": 10,
            "message": "Converting PDF to DOCX..."
        }));

        // Execute Python converter.
        let result = Command::new(&python_path)
            .arg(&script_path)
            .arg(&input_path)
            .arg(&output_path)
            .output()
            .map_err(|e| format!("Failed to start PDF converter: {e}"))?;

        if !result.status.success() {
            let _ = fs::remove_file(&output_path);

            return Err(format!(
                "PDF to DOCX conversion failed: {}",
                String::from_utf8_lossy(&result.stderr)
            ));
        }

        if !output_path.exists() {
            return Err("Converted DOCX was not generated.".to_string());
        }

        let _ = app.emit("conversion-progress", serde_json::json!({
            "current": 1,
            "total": 1,
            "percentage": 100,
            "message": "Conversion completed!"
        }));

        Ok(vec![output_path.to_string_lossy().to_string()])
    })
    .await
    .map_err(|e| format!("Conversion task failed: {e}"))?
}