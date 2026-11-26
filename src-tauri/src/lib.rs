use std::{path::PathBuf, sync::Mutex, time::Duration};

use notify_debouncer_mini::{
    new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer,
};
use tauri::{AppHandle, Emitter, Manager, State};

/// The one file watcher for the open document. Replacing it drops the old one,
/// which stops watching the previous file.
#[derive(Default)]
struct DocWatcher(Mutex<Option<Debouncer<RecommendedWatcher>>>);

/// Reads a text file. Invalid UTF-8 is replaced rather than failing the whole
/// document, and a leading BOM is dropped so it never shows up as a stray glyph.
#[tauri::command]
fn read_markdown(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    Ok(text.strip_prefix('\u{feff}').unwrap_or(&text).to_string())
}

/// The file Folio was launched with (double-click, "Open with", or a CLI arg).
#[tauri::command]
fn initial_file() -> Option<String> {
    std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .map(PathBuf::from)
        .find(|p| p.is_file())
        .and_then(|p| std::path::absolute(p).ok())
        .map(|p| p.to_string_lossy().into_owned())
}

#[derive(serde::Serialize)]
struct FolderScan {
    files: Vec<String>,
    truncated: bool,
}

const SCAN_LIMIT: usize = 5000;
const SCAN_DEPTH: usize = 12;
/// Folders that hold dependencies or build output, never docs worth reading.
const SKIP_DIRS: &[&str] = &[
    "node_modules", "target", "dist", "build", "out", "vendor", "venv", "__pycache__", "site-packages",
];

fn is_markdown(p: &std::path::Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "md" | "markdown" | "mdown" | "mkd"))
        .unwrap_or(false)
}

fn walk(dir: &std::path::Path, depth: usize, out: &mut Vec<String>) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else { return false };
    let mut subdirs = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_dir() {
            // Hidden folders (.git, .venv, .next, ...) and dependency folders are skipped.
            if !name.starts_with('.') && !SKIP_DIRS.contains(&name.as_ref()) {
                subdirs.push(path);
            }
        } else if kind.is_file() && is_markdown(&path) {
            if out.len() >= SCAN_LIMIT {
                return true;
            }
            out.push(path.to_string_lossy().into_owned());
        }
    }
    if depth < SCAN_DEPTH {
        for sub in subdirs {
            if walk(&sub, depth + 1, out) {
                return true;
            }
        }
    }
    false
}

/// Lists every Markdown file under a folder (recursive), skipping hidden and
/// dependency folders. Runs off the main thread so a big tree never freezes the UI.
#[tauri::command]
async fn scan_folder(path: String) -> Result<FolderScan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(&path);
        if !root.is_dir() {
            return Err(format!("Not a folder: {path}"));
        }
        let mut files = Vec::new();
        let truncated = walk(&root, 0, &mut files);
        files.sort_by_key(|f| f.to_lowercase());
        Ok(FolderScan { files, truncated })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Watches the open file and emits `file-changed` when it is saved.
/// The parent folder is watched, not the file itself, because many editors save
/// by writing a temp file and renaming it over the original.
#[tauri::command]
fn watch_file(app: AppHandle, state: State<DocWatcher>, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let dir = target
        .parent()
        .ok_or("file has no parent folder")?
        .to_path_buf();
    let target_key = path.to_lowercase();

    let mut debouncer = new_debouncer(
        Duration::from_millis(200),
        move |res: DebounceEventResult| {
            if let Ok(events) = res {
                let hit = events
                    .iter()
                    .any(|e| e.path.to_string_lossy().to_lowercase() == target_key);
                if hit {
                    let _ = app.emit("file-changed", &path);
                }
            }
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watcher()
        .watch(&dir, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    *state.0.lock().map_err(|e| e.to_string())? = Some(debouncer);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .manage(DocWatcher::default())
    .invoke_handler(tauri::generate_handler![read_markdown, initial_file, watch_file, scan_folder])
    .setup(|app| {
      // The window starts hidden and the page shows it after first paint.
      // Safety net: if the page never gets that far, show it anyway.
      let handle = app.handle().clone();
      std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(2500));
        if let Some(w) = handle.get_webview_window("main") {
          let _ = w.show();
        }
      });
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
