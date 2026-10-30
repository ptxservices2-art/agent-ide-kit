use std::fs;
use std::path::PathBuf;

fn store_path(workspace: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(workspace)
        .canonicalize()
        .map_err(|e| format!("workspace inválido: {e}"))?;
    Ok(root.join(".ia-ptx").join("chats.json"))
}

#[tauri::command]
pub fn load_chat_store(workspace: String) -> Result<String, String> {
    let path = store_path(&workspace)?;
    if !path.exists() {
        return Ok(r#"{"activeId":null,"chats":[]}"#.into());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_chat_store(workspace: String, json: String) -> Result<(), String> {
    let path = store_path(&workspace)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, json).map_err(|e| e.to_string())
}
