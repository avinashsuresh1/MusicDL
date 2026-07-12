use std::collections::HashMap;
use std::fs;
use std::path::{Path};

#[derive(serde::Serialize)]
struct OpenProjectResult {
    path: String,
    files: HashMap<String, String>,
}

fn read_dir_recursive(dir: &Path, root_dir: &Path, files: &mut HashMap<String, String>) -> std::io::Result<()> {
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                if name == "node_modules" || name == ".git" || name == "dist" {
                    continue;
                }
                read_dir_recursive(&path, root_dir, files)?;
            } else {
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                if name.ends_with(".yaml") || name.ends_with(".yml") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(rel_path) = path.strip_prefix(root_dir) {
                            let rel_path_str = rel_path.to_string_lossy().replace("\\", "/");
                            files.insert(rel_path_str, content);
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

fn save_dir(dir_path: &str, files: HashMap<String, String>) -> std::io::Result<()> {
    let root = Path::new(dir_path);
    for (rel_path, content) in files {
        let full_path = root.join(&rel_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(full_path, content)?;
    }
    Ok(())
}

#[tauri::command]
fn open_project_directory() -> Result<Option<OpenProjectResult>, String> {
    let dir = rfd::FileDialog::new()
        .set_title("Select MusicDL Project Folder")
        .pick_folder();

    match dir {
        Some(path) => {
            let mut files = HashMap::new();
            if let Err(e) = read_dir_recursive(&path, &path, &mut files) {
                return Err(format!("Failed to read directory: {}", e));
            }
            Ok(Some(OpenProjectResult {
                path: path.to_string_lossy().into_owned(),
                files,
            }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn save_project_directory(path: String, files: HashMap<String, String>) -> Result<(), String> {
    if let Err(e) = save_dir(&path, files) {
        return Err(format!("Failed to save directory: {}", e));
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![open_project_directory, save_project_directory])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
