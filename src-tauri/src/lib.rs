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

fn is_yaml_path(p: &str) -> bool {
    let lower = p.to_lowercase();
    lower.ends_with(".yaml") || lower.ends_with(".yml")
}

fn is_safe_path(rel_path: &str) -> bool {
    let path = Path::new(rel_path);
    is_yaml_path(rel_path) && !rel_path.contains("..") && path.is_relative()
}

fn save_dir(dir_path: &str, files: HashMap<String, String>) -> std::io::Result<()> {
    let root = Path::new(dir_path);
    for (rel_path, content) in files {
        if !is_safe_path(&rel_path) {
            continue; // Skip unsafe paths for security
        }
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
    // Validate all file paths before writing anything
    for rel_path in files.keys() {
        if !is_safe_path(rel_path) {
            return Err(format!("Security error: path '{}' is not a valid relative YAML file path", rel_path));
        }
    }

    if let Err(e) = save_dir(&path, files) {
        return Err(format!("Failed to save directory: {}", e));
    }
    Ok(())
}

#[tauri::command]
fn rename_file(path: String, old_rel: String, new_rel: String) -> Result<(), String> {
    if !is_safe_path(&old_rel) || !is_safe_path(&new_rel) {
        return Err(format!("Security error: Invalid old or new path for rename. Only YAML files permitted."));
    }

    let root = Path::new(&path);
    let old_path = root.join(&old_rel);
    let new_path = root.join(&new_rel);

    if old_path.exists() {
        if let Some(parent) = new_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                return Err(format!("Failed to create parent folders: {}", e));
            }
        }
        if let Err(e) = fs::rename(&old_path, &new_path) {
            return Err(format!("Failed to rename file: {}", e));
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_file(path: String, rel_path: String) -> Result<(), String> {
    if !is_safe_path(&rel_path) {
        return Err(format!("Security error: Only YAML files can be deleted."));
    }

    let root = Path::new(&path);
    let file_path = root.join(&rel_path);

    if file_path.exists() {
        if let Err(e) = fs::remove_file(&file_path) {
            return Err(format!("Failed to delete file: {}", e));
        }
    }
    Ok(())
}

#[tauri::command]
fn create_new_project_directory(default_files: HashMap<String, String>) -> Result<Option<OpenProjectResult>, String> {
    // Validate template paths
    for rel_path in default_files.keys() {
        if !is_safe_path(rel_path) {
            return Err(format!("Security error: default path '{}' is not valid", rel_path));
        }
    }

    let dir = rfd::FileDialog::new()
        .set_title("Select Folder for New MusicDL Project")
        .pick_folder();

    match dir {
        Some(path) => {
            let project_path = path.join("MusicDL Project");
            if let Err(e) = save_dir(&project_path.to_string_lossy(), default_files) {
                return Err(format!("Failed to initialize project files: {}", e));
            }
            
            let mut files = HashMap::new();
            if let Err(e) = read_dir_recursive(&project_path, &project_path, &mut files) {
                return Err(format!("Failed to read back directory: {}", e));
            }
            
            Ok(Some(OpenProjectResult {
                path: project_path.to_string_lossy().into_owned(),
                files,
            }))
        }
        None => Ok(None),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(target_os = "linux")]
  {
    std::env::set_var("PULSE_PROP", "media.role=music");
    std::env::set_var("PIPEWIRE_PROPS", "media.role=music");
    
    // Force GStreamer to use PulseAudio/PipeWire instead of falling back to raw ALSA devices.
    // This allows audio to route properly to Bluetooth A2DP headphones.
    if std::env::var("GST_AUDIOSINK").is_err() {
      std::env::set_var("GST_AUDIOSINK", "pulsesink");
    }
  }

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
    .invoke_handler(tauri::generate_handler![
      open_project_directory,
      save_project_directory,
      rename_file,
      delete_file,
      create_new_project_directory
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
