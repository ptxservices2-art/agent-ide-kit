mod ai;
mod chats;
mod fs_ops;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            fs_ops::list_dir,
            fs_ops::read_file,
            fs_ops::write_file,
            fs_ops::str_replace,
            fs_ops::path_exists,
            fs_ops::search_files,
            fs_ops::workspace_context,
            fs_ops::git_status,
            chats::load_chat_store,
            chats::save_chat_store,
            ai::agent_turn,
            ai::ai_status,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar IA-PTX");
}
