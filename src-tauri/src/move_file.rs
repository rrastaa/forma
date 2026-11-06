use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Serialize)]
pub struct MoveResult {
    pub source_path: String,
    pub destination_path: String,
    pub status: String,
    pub message: String,
}

fn get_unique_path(directory: &Path, filename: &str) -> PathBuf {
    let original = Path::new(filename);

    let stem = original
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("file");

    let extension = original.extension().and_then(|ext| ext.to_str());

    let mut counter = 2;

    loop {
        let name = match extension {
            Some(ext) => format!("{stem} ({counter}).{ext}"),
            None => format!("{stem} ({counter})"),
        };

        let candidate = directory.join(name);

        if !candidate.exists() {
            return candidate;
        }

        counter += 1;
    }
}

fn move_one(source: &Path, destination_folder: &Path, conflict_action: &str) -> MoveResult {
    let source_string = source.to_string_lossy().to_string();

    let filename = match source.file_name() {
        Some(name) => name,
        None => {
            return MoveResult {
                source_path: source_string.clone(),
                destination_path: String::new(),
                status: "failed".into(),
                message: "Invalid source filename.".into(),
            };
        }
    };

    let mut destination = destination_folder.join(filename);

    if source == destination {
        return MoveResult {
            source_path: source_string.clone(),
            destination_path: source_string,
            status: "skipped".into(),
            message: "File is already in the destination folder.".into(),
        };
    }

    if destination.exists() {
        match conflict_action {
            "ask" => {
                return MoveResult {
                    source_path: source_string,
                    destination_path: destination.to_string_lossy().to_string(),
                    status: "conflict".into(),
                    message: "A file with the same name already exists.".into(),
                };
            }

            "skip" => {
                return MoveResult {
                    source_path: source_string,
                    destination_path: destination.to_string_lossy().to_string(),
                    status: "skipped".into(),
                    message: "A file with the same name already exists.".into(),
                };
            }

            "replace" => {}

            "keep_both" => {
                destination = get_unique_path(destination_folder, &filename.to_string_lossy());
            }

            _ => {
                return MoveResult {
                    source_path: source_string,
                    destination_path: destination.to_string_lossy().to_string(),
                    status: "failed".into(),
                    message: "Invalid conflict action.".into(),
                };
            }
        }
    }

    // First try a normal rename (same-volume move).
    let move_result = fs::rename(source, &destination);

    // If rename fails, use copy + rename + remove.
    let result = match move_result {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);

            let temp_path = destination_folder
                .join(format!(".forma-move-{}-{counter}.tmp", std::process::id()));

            match fs::copy(source, &temp_path) {
                Ok(_) => match fs::rename(&temp_path, &destination) {
                    Ok(()) => fs::remove_file(source),
                    Err(error) => {
                        let _ = fs::remove_file(&temp_path);
                        Err(error)
                    }
                },
                Err(copy_error) => Err(std::io::Error::new(
                    copy_error.kind(),
                    format!("Move failed: {rename_error}. Copy fallback failed: {copy_error}"),
                )),
            }
        }
    };

    match result {
        Ok(()) => MoveResult {
            source_path: source_string,
            destination_path: destination.to_string_lossy().to_string(),
            status: "success".into(),
            message: "File moved successfully.".into(),
        },
        Err(error) => MoveResult {
            source_path: source_string,
            destination_path: destination.to_string_lossy().to_string(),
            status: "failed".into(),
            message: error.to_string(),
        },
    }
}

#[tauri::command]
pub async fn move_files(
    input_paths: Vec<String>,
    destination: String,
    conflict_action: String,
) -> Result<Vec<MoveResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let destination_folder = Path::new(&destination);

        if !destination_folder.exists() || !destination_folder.is_dir() {
            return Err("Destination folder does not exist.".to_string());
        }

        if !["ask", "skip", "replace", "keep_both"].contains(&conflict_action.as_str()) {
            return Err("Invalid conflict action.".to_string());
        }

        if input_paths.is_empty() {
            return Err("No files selected.".to_string());
        }

        let mut results = Vec::new();

        for input_path in input_paths {
            let source = Path::new(&input_path);

            if !source.exists() || !source.is_file() {
                results.push(MoveResult {
                    source_path: input_path,
                    destination_path: String::new(),
                    status: "failed".into(),
                    message: "Source file does not exist.".into(),
                });
                continue;
            }

            results.push(move_one(source, destination_folder, &conflict_action));
        }

        Ok(results)
    })
    .await
    .map_err(|error| format!("Move task failed: {error}"))?
}
