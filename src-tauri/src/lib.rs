use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::{Emitter, Manager};

#[derive(Clone, Serialize)]
struct ConversionProgress {
    current: usize,
    total: usize,
    percentage: u8,
    message: String,
}
#[derive(Clone, Serialize)]
struct SelectedFinderFile {
    name: String,
    path: String,
    extension: String,
}

#[tauri::command]
fn get_selected_finder_file() -> Result<Vec<SelectedFinderFile>, String> {
    let script = r#"
        tell application "Finder"
            set selectedItems to selection
            set itemCount to count of selectedItems

            if itemCount is 0 then
                return ""
            end if

            set selectedPaths to {}

            repeat with selectedItem in selectedItems
                set end of selectedPaths to POSIX path of (selectedItem as alias)
            end repeat

            set AppleScript's text item delimiters to (ASCII character 30)
            set outputText to selectedPaths as text
            set AppleScript's text item delimiters to ""

            return outputText
        end tell
    "#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("AppleScript execution failed: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let output_text = String::from_utf8_lossy(&output.stdout);
    let output_text = output_text.trim_end_matches('\n');

    if output_text.is_empty() {
        return Ok(Vec::new());
    }

    let selected_files = output_text
        .split('\u{1e}')
        .map(|path| {
            let file_path = Path::new(path);

            let name = file_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("Unknown file")
                .to_string();

            let extension = file_path
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("")
                .to_lowercase();

            SelectedFinderFile {
                name,
                path: path.to_string(),
                extension,
            }
        })
        .collect();

    Ok(selected_files)
}

#[tauri::command]
async fn convert_pdf(
    app: tauri::AppHandle,
    input_path: String,
    output_format: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        convert_pdf_blocking(app, input_path, output_format)
    })
    .await
    .map_err(|e| format!("Conversion task failed: {}", e))?
}

fn convert_pdf_blocking(
    app: tauri::AppHandle,
    input_path: String,
    output_format: String,
) -> Result<Vec<String>, String> {
    let input = Path::new(&input_path);

    if !input.exists() || !input.is_file() {
        return Err("Source file does not exist.".to_string());
    }

    let extension = input
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    if extension != "pdf" {
        return Err("Only PDF files are supported.".to_string());
    }

    let format = output_format.to_lowercase();

    if !["png", "jpg"].contains(&format.as_str()) {
        return Err("Supported formats are PNG and JPG.".to_string());
    }

    let magick_path = if Path::new("/opt/homebrew/bin/magick").exists() {
        "/opt/homebrew/bin/magick"
    } else {
        "magick"
    };

    // Hitung jumlah halaman PDF
    let identify = Command::new(magick_path)
        .arg("identify")
        .arg("-format")
        .arg("%s\n")
        .arg(&input_path)
        .output()
        .map_err(|e| format!("Failed to inspect PDF: {}", e))?;

    if !identify.status.success() {
        return Err(format!(
            "Failed to read PDF pages: {}",
            String::from_utf8_lossy(&identify.stderr).trim()
        ));
    }

    let total_pages = String::from_utf8_lossy(&identify.stdout).lines().count();

    if total_pages == 0 {
        return Err("PDF contains no readable pages.".to_string());
    }

    // Buat folder output unik
    let parent = input.parent().ok_or("Cannot determine source directory.")?;

    let stem = input
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("document");

    let mut output_dir = parent.join(format!("{}-converted", stem));
    let mut counter = 2;

    while output_dir.exists() {
        output_dir = parent.join(format!("{}-converted-{}", stem, counter));
        counter += 1;
    }

    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output folder: {}", e))?;

    // Progress awal
    let _ = app.emit(
        "conversion-progress",
        ConversionProgress {
            current: 0,
            total: total_pages,
            percentage: 0,
            message: "Preparing conversion...".to_string(),
        },
    );

    let mut output_files = Vec::new();

    // Konversi halaman satu per satu
    for page in 0..total_pages {
        let page_input = format!("{}[{}]", input_path, page);

        let output_path = output_dir.join(format!("page-{:03}.{}", page + 1, format));

        let mut command = Command::new(magick_path);

        command.arg("-density").arg("150").arg(&page_input);

        if format == "jpg" {
            command
                .arg("-background")
                .arg("white")
                .arg("-alpha")
                .arg("remove")
                .arg("-alpha")
                .arg("off");
        }

        command.arg(&output_path);

        let output = command
            .output()
            .map_err(|e| format!("Failed to execute ImageMagick: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Failed to convert page {}: {}",
                page + 1,
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }

        if !output_path.exists() {
            return Err(format!("Output for page {} was not created.", page + 1));
        }

        output_files.push(output_path.to_string_lossy().to_string());

        // Kirim progress setelah halaman selesai
        let completed = page + 1;
        let percentage = ((completed * 100) / total_pages) as u8;

        let _ = app.emit(
            "conversion-progress",
            ConversionProgress {
                current: completed,
                total: total_pages,
                percentage,
                message: format!("Converting page {} of {}...", completed, total_pages),
            },
        );
    }

    Ok(output_files)
}

#[tauri::command]
async fn convert_image_to_pdf(
    app: tauri::AppHandle,
    input_path: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || convert_image_to_pdf_blocking(app, input_path))
        .await
        .map_err(|e| format!("Conversion task failed: {}", e))?
}

fn convert_image_to_pdf_blocking(
    app: tauri::AppHandle,
    input_path: String,
) -> Result<Vec<String>, String> {
    let input = Path::new(&input_path);

    // Validate source file
    if !input.exists() || !input.is_file() {
        return Err("Source file does not exist.".to_string());
    }

    let extension = input
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !["png", "jpg", "jpeg", "webp"].contains(&extension.as_str()) {
        return Err("Only PNG, JPG, JPEG, and WebP images are supported.".to_string());
    }

    let magick_path = if Path::new("/opt/homebrew/bin/magick").exists() {
        "/opt/homebrew/bin/magick"
    } else {
        "magick"
    };

    // Determine output directory
    let parent = input.parent().ok_or("Cannot determine source directory.")?;

    let stem = input
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("image");

    let mut output_dir = parent.join(format!("{}-converted", stem));
    let mut counter = 2;

    while output_dir.exists() {
        output_dir = parent.join(format!("{}-converted-{}", stem, counter));
        counter += 1;
    }

    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output folder: {}", e))?;

    let output_path = output_dir.join(format!("{}.pdf", stem));

    // Initial progress
    let _ = app.emit(
        "conversion-progress",
        ConversionProgress {
            current: 0,
            total: 1,
            percentage: 0,
            message: "Preparing PDF conversion...".to_string(),
        },
    );

    // Convert image to PDF
    let output = Command::new(magick_path)
        .arg("-density")
        .arg("150")
        .arg(&input_path)
        .arg("-auto-orient")
        .arg("-background")
        .arg("white")
        .arg("-alpha")
        .arg("remove")
        .arg("-alpha")
        .arg("off")
        .arg(&output_path)
        .output()
        .map_err(|e| format!("Failed to execute ImageMagick: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to convert image to PDF: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    if !output_path.exists() {
        return Err("PDF output was not created.".to_string());
    }

    // Completed progress
    let _ = app.emit(
        "conversion-progress",
        ConversionProgress {
            current: 1,
            total: 1,
            percentage: 100,
            message: "PDF conversion completed!".to_string(),
        },
    );

    Ok(vec![output_path.to_string_lossy().to_string()])
}

#[tauri::command]
async fn merge_pdf(app: tauri::AppHandle, input_paths: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || merge_pdf_blocking(app, input_paths))
        .await
        .map_err(|e| format!("Merge task failed: {}", e))?
}

fn merge_pdf_blocking(app: tauri::AppHandle, input_paths: Vec<String>) -> Result<String, String> {
    // Validate number of files
    if input_paths.len() < 2 {
        return Err("At least 2 PDF files are required.".to_string());
    }

    // Validate all input files
    for path in &input_paths {
        let input = Path::new(path);

        if !input.exists() || !input.is_file() {
            return Err(format!("File does not exist: {}", path));
        }

        let extension = input
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension != "pdf" {
            return Err(format!("Only PDF files are supported: {}", path));
        }
    }

    // Determine output directory from the first PDF
    let first_input = Path::new(&input_paths[0]);

    let output_dir = first_input
        .parent()
        .ok_or("Cannot determine output directory.")?;

    // Generate a unique output filename
    let mut output_path = output_dir.join("merged.pdf");
    let mut counter = 2;

    while output_path.exists() {
        output_path = output_dir.join(format!("merged-{}.pdf", counter));
        counter += 1;
    }

    let output_string = output_path.to_string_lossy().to_string();

    // Locate qpdf
    let qpdf_path = if Path::new("/opt/homebrew/bin/qpdf").exists() {
        "/opt/homebrew/bin/qpdf"
    } else {
        "qpdf"
    };

    // Initial progress
    let _ = app.emit(
        "merge-progress",
        ConversionProgress {
            current: 0,
            total: input_paths.len(),
            percentage: 0,
            message: "Preparing PDF merge...".to_string(),
        },
    );

    // Build qpdf command
    let mut command = Command::new(qpdf_path);

    command.arg("--empty").arg("--pages");

    for path in &input_paths {
        command.arg(path);
    }

    command.arg("--").arg(&output_path);

    let output = command
        .output()
        .map_err(|e| format!("Failed to execute qpdf: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "PDF merge failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    if !output_path.exists() {
        return Err("Merged PDF output was not created.".to_string());
    }

    // Completed progress
    let _ = app.emit(
        "merge-progress",
        ConversionProgress {
            current: input_paths.len(),
            total: input_paths.len(),
            percentage: 100,
            message: "PDF merge completed!".to_string(),
        },
    );

    Ok(output_string)
}

#[tauri::command]
async fn split_pdf(
    app: tauri::AppHandle,
    input_path: String,
    mode: String,
    page_ranges: Option<String>,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        split_pdf_blocking(app, input_path, mode, page_ranges)
    })
    .await
    .map_err(|e| format!("Split task failed: {}", e))?
}

fn split_pdf_blocking(
    app: tauri::AppHandle,
    input_path: String,
    mode: String,
    page_ranges: Option<String>,
) -> Result<Vec<String>, String> {
    let input = Path::new(&input_path);

    if !input.exists() || !input.is_file() {
        return Err("Source file does not exist.".to_string());
    }

    let extension = input
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    if extension != "pdf" {
        return Err("Only PDF files are supported.".to_string());
    }

    let qpdf_path = if Path::new("/opt/homebrew/bin/qpdf").exists() {
        "/opt/homebrew/bin/qpdf"
    } else {
        "qpdf"
    };

    // Get PDF page count.
    let page_count_output = Command::new(qpdf_path)
        .arg("--show-npages")
        .arg(&input_path)
        .output()
        .map_err(|e| format!("Failed to inspect PDF: {}", e))?;

    if !page_count_output.status.success() {
        return Err(format!(
            "Failed to read PDF: {}",
            String::from_utf8_lossy(&page_count_output.stderr).trim()
        ));
    }

    let total_pages: usize = String::from_utf8_lossy(&page_count_output.stdout)
        .trim()
        .parse()
        .map_err(|_| "Could not determine PDF page count.".to_string())?;

    if total_pages == 0 {
        return Err("PDF contains no pages.".to_string());
    }

    // Determine output directory.
    let parent = input.parent().ok_or("Cannot determine source directory.")?;

    let stem = input
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("document");

    let mut output_dir = parent.join(format!("{}-split", stem));
    let mut counter = 2;

    while output_dir.exists() {
        output_dir = parent.join(format!("{}-split-{}", stem, counter));
        counter += 1;
    }

    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output folder: {}", e))?;

    let _ = app.emit(
        "split-progress",
        ConversionProgress {
            current: 0,
            total: total_pages,
            percentage: 0,
            message: "Preparing PDF split...".to_string(),
        },
    );

    let mut output_files = Vec::new();

    match mode.as_str() {
        "range" => {
            let ranges = page_ranges.ok_or("Please enter page ranges, e.g. 1-3, 5, 8-10.")?;

            let parsed_ranges: Vec<(usize, usize)> = ranges
                .split(',')
                .map(|part| {
                    let part = part.trim();

                    if part.is_empty() {
                        return Err("Page range cannot be empty.".to_string());
                    }

                    let bounds: Vec<&str> = part.split('-').collect();

                    if bounds.len() > 2 {
                        return Err(format!("Invalid page range: {}", part));
                    }

                    let start: usize = bounds[0]
                        .trim()
                        .parse()
                        .map_err(|_| format!("Invalid page number: {}", part))?;

                    let end: usize = if bounds.len() == 2 {
                        bounds[1]
                            .trim()
                            .parse()
                            .map_err(|_| format!("Invalid page range: {}", part))?
                    } else {
                        start
                    };

                    if start == 0 || end == 0 || start > end {
                        return Err(format!("Invalid page range: {}", part));
                    }

                    if end > total_pages {
                        return Err(format!(
                            "Page {} exceeds the document's {} pages.",
                            end, total_pages
                        ));
                    }

                    Ok((start, end))
                })
                .collect::<Result<Vec<_>, String>>()?;

            if parsed_ranges.is_empty() {
                return Err("Please enter at least one page range.".to_string());
            }

            for (index, (start, end)) in parsed_ranges.iter().enumerate() {
                let range = if start == end {
                    start.to_string()
                } else {
                    format!("{}-{}", start, end)
                };

                let output_path = output_dir.join(format!("range-{:03}.pdf", index + 1));

                let output = Command::new(qpdf_path)
                    .arg(&input_path)
                    .arg("--pages")
                    .arg(".")
                    .arg(&range)
                    .arg("--")
                    .arg(&output_path)
                    .output()
                    .map_err(|e| format!("Failed to execute qpdf: {}", e))?;

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);

                    if !output.status.success() && !Path::new(&output_path).exists() {
                        return Err(format!("Failed to split range {}: {}", range, stderr));
                    }
                }

                if !output_path.exists() {
                    return Err(format!("Output for range {} was not created.", range));
                }

                output_files.push(output_path.to_string_lossy().to_string());

                let completed = index + 1;
                let total = parsed_ranges.len();

                let _ = app.emit(
                    "split-progress",
                    ConversionProgress {
                        current: completed,
                        total,
                        percentage: ((completed * 100) / total) as u8,
                        message: format!("Splitting range {} of {}...", completed, total),
                    },
                );
            }
        }

        "all" => {
            let output_pattern = output_dir.join("page-%d.pdf");

            let output = Command::new(qpdf_path)
                .arg("--split-pages")
                .arg(&input_path)
                .arg(&output_pattern)
                .output()
                .map_err(|e| format!("Failed to execute qpdf: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "Failed to split PDF pages: {}",
                    String::from_utf8_lossy(&output.stderr).trim()
                ));
            }

            for entry in fs::read_dir(&output_dir)
                .map_err(|e| format!("Failed to read output folder: {}", e))?
            {
                let path = entry
                    .map_err(|e| format!("Failed to read output file: {}", e))?
                    .path();

                if path.extension().and_then(|ext| ext.to_str()) == Some("pdf") {
                    output_files.push(path.to_string_lossy().to_string());
                }
            }

            output_files.sort();

            if output_files.len() != total_pages {
                return Err(format!(
                    "Expected {} output files, but found {}.",
                    total_pages,
                    output_files.len()
                ));
            }

            let _ = app.emit(
                "split-progress",
                ConversionProgress {
                    current: total_pages,
                    total: total_pages,
                    percentage: 100,
                    message: "PDF split completed!".to_string(),
                },
            );
        }

        _ => return Err("Unsupported split mode.".to_string()),
    }

    Ok(output_files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_selected_finder_file,
            convert_pdf,
            convert_image_to_pdf,
            merge_pdf,
            split_pdf,
            reveal_in_finder,
        ])
        .setup(|_app| {
            let window = _app.get_webview_window("main").unwrap();

            window.open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("Output file does not exist.".to_string());
    }

    let status = Command::new("open")
        .arg("-R")
        .arg(file_path)
        .status()
        .map_err(|e| format!("Failed to open Finder: {}", e))?;

    if !status.success() {
        return Err("Finder could not reveal the file.".to_string());
    }

    Ok(())
}
