use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

fn should_skip(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | ".git"
            | ".venv"
            | "venv"
            | "dist"
            | "build"
            | "__pycache__"
            | ".next"
            | ".turbo"
            | "coverage"
            | ".tool_deps"
    )
}

fn is_heavy_dir(name: &str) -> bool {
    let n = name.to_lowercase();
    n.starts_with("dump")
        || n.contains("runtime_")
        || n == "offline_output"
        || n == "node_modules"
        || n == ".venv"
        || n == "target"
        || n == ".tool_deps"
}

fn is_binary_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".dat")
        || lower.ends_with(".apk")
        || lower.ends_with(".so")
        || lower.ends_with(".dll")
        || lower.ends_with(".exe")
        || lower.ends_with(".bin")
        || lower.ends_with(".pyc")
        || lower.ends_with(".o")
        || lower.ends_with(".a")
        || lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".webp")
        || lower.ends_with(".gif")
        || lower.ends_with(".ico")
        || lower.ends_with(".zip")
        || lower.ends_with(".rar")
        || lower.ends_with(".7z")
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in path.components() {
        match c {
            Component::Prefix(p) => out.push(p.as_os_str()),
            Component::RootDir => out.push(c.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            Component::Normal(s) => out.push(s),
        }
    }
    out
}

pub fn resolve_workspace_path(workspace: &str, path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(workspace)
        .canonicalize()
        .map_err(|e| format!("workspace inválido: {e}"))?;
    let raw = PathBuf::from(path);
    let joined = if raw.is_absolute() {
        raw
    } else {
        root.join(raw)
    };
    let normalized = normalize_path(&joined);
    if !normalized.starts_with(&root) {
        return Err("acesso fora do workspace bloqueado".into());
    }
    Ok(normalized)
}

fn append_tree(
    dir: &Path,
    prefix: &str,
    depth: usize,
    max_depth: usize,
    out: &mut String,
    budget: &mut usize,
) {
    if depth > max_depth || *budget == 0 {
        return;
    }
    let Ok(rd) = fs::read_dir(dir) else {
        return;
    };
    let mut entries: Vec<_> = rd.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| {
        let is_dir = e.path().is_dir();
        (!is_dir, e.file_name().to_string_lossy().to_lowercase())
    });

    for entry in entries {
        if *budget == 0 {
            out.push_str(&format!("{prefix}…\n"));
            break;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) || (name.starts_with('.') && name != ".env.example") {
            continue;
        }
        if is_binary_name(&name) {
            continue;
        }
        let path = entry.path();
        let is_dir = path.is_dir();
        out.push_str(&format!(
            "{prefix}{}{}\n",
            name,
            if is_dir { "/" } else { "" }
        ));
        *budget = budget.saturating_sub(1);
        if is_dir && depth < max_depth && !is_heavy_dir(&name) {
            append_tree(
                &path,
                &format!("{prefix}  "),
                depth + 1,
                max_depth,
                out,
                budget,
            );
        } else if is_dir && is_heavy_dir(&name) {
            out.push_str(&format!("{prefix}  …(pasta grande, omitida)\n"));
        }
    }
}

fn read_snippet(root: &Path, relative: &str, max_chars: usize) -> Option<String> {
    let path = root.join(relative);
    if !path.is_file() {
        return None;
    }
    let text = fs::read_to_string(&path).ok()?;
    let snippet = if text.chars().count() > max_chars {
        let cut: String = text.chars().take(max_chars).collect();
        format!("{cut}…")
    } else {
        text
    };
    Some(format!("### {relative}\n{snippet}\n"))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceContext {
    pub path: String,
    pub name: String,
    pub tree: String,
    pub overview: String,
}

#[tauri::command]
pub fn list_dir(workspace: String, path: Option<String>) -> Result<Vec<DirEntry>, String> {
    let root = PathBuf::from(&workspace)
        .canonicalize()
        .map_err(|e| format!("workspace inválido: {e}"))?;
    let dir = match path {
        Some(p) if !p.is_empty() => resolve_workspace_path(&workspace, &p)?,
        _ => root,
    };

    if !dir.is_dir() {
        return Err("não é um diretório".into());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        // Explorer mostra tudo (como Cursor), esconde metadados internos
        if name == ".git" || name == ".ia-ptx" {
            continue;
        }
        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
        });
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
}

#[tauri::command]
pub fn git_status(workspace: String) -> Result<Vec<GitFileStatus>, String> {
    use std::process::Command;

    let root = PathBuf::from(&workspace)
        .canonicalize()
        .map_err(|e| format!("workspace inválido: {e}"))?;

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(&root)
        .output()
        .map_err(|e| format!("git: {e}"))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut rows = Vec::new();
    for line in text.lines() {
        if line.len() < 4 {
            continue;
        }
        let code = line[..2].to_string();
        let raw = line[3..].trim().to_string();
        let path = if let Some((_a, b)) = raw.split_once(" -> ") {
            b.to_string()
        } else {
            raw
        };
        let status = if code.contains('?') {
            "U".into()
        } else if code.contains('A') {
            "A".into()
        } else if code.contains('M') || code.chars().any(|c| c == 'M') {
            "M".into()
        } else if code.contains('D') {
            "D".into()
        } else {
            code.trim().chars().next().unwrap_or('M').to_string()
        };
        let abs = root.join(&path).to_string_lossy().to_string();
        rows.push(GitFileStatus {
            path: abs,
            status,
        });
    }
    Ok(rows)
}

#[tauri::command]
pub fn read_file(workspace: String, path: String) -> Result<String, String> {
    let file = resolve_workspace_path(&workspace, &path)?;
    if !file.is_file() {
        return Err(format!("arquivo não encontrado: {}", file.display()));
    }
    let name = file
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    if is_binary_name(&name) {
        return Err(format!(
            "arquivo binário bloqueado ({name}). Não use read_file nele."
        ));
    }
    let meta = fs::metadata(&file).map_err(|e| e.to_string())?;
    if meta.len() > 400_000 {
        return Err(format!(
            "arquivo grande demais ({} bytes). Peça um trecho ou outro arquivo.",
            meta.len()
        ));
    }
    fs::read_to_string(file).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file(workspace: String, path: String, content: String) -> Result<String, String> {
    let file = resolve_workspace_path(&workspace, &path)?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file, content).map_err(|e| e.to_string())?;
    Ok(file.to_string_lossy().to_string())
}

#[tauri::command]
pub fn str_replace(
    workspace: String,
    path: String,
    old_string: String,
    new_string: String,
) -> Result<String, String> {
    let file = resolve_workspace_path(&workspace, &path)?;
    if !file.is_file() {
        return Err(format!("arquivo não encontrado: {}", file.display()));
    }
    let current = fs::read_to_string(&file).map_err(|e| e.to_string())?;
    let matches = current.matches(&old_string).count();
    if matches == 0 {
        return Err("old_string não encontrado no arquivo".into());
    }
    if matches > 1 {
        return Err(format!(
            "old_string aparece {matches} vezes — use um trecho único"
        ));
    }
    let updated = current.replacen(&old_string, &new_string, 1);
    fs::write(&file, &updated).map_err(|e| e.to_string())?;
    Ok(file.to_string_lossy().to_string())
}

#[tauri::command]
pub fn path_exists(workspace: String, path: String) -> Result<bool, String> {
    let file = resolve_workspace_path(&workspace, &path)?;
    Ok(file.exists())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub line: usize,
    pub text: String,
}

#[tauri::command]
pub fn search_files(
    workspace: String,
    query: String,
    path: Option<String>,
) -> Result<Vec<SearchHit>, String> {
    if query.trim().is_empty() {
        return Err("query vazia".into());
    }
    let root = match path {
        Some(p) if !p.is_empty() => resolve_workspace_path(&workspace, &p)?,
        _ => PathBuf::from(&workspace)
            .canonicalize()
            .map_err(|e| e.to_string())?,
    };

    let mut hits = Vec::new();
    walk_search(&root, &root, &query, &mut hits, 40);
    Ok(hits)
}

fn walk_search(root: &Path, dir: &Path, query: &str, hits: &mut Vec<SearchHit>, limit: usize) {
    if hits.len() >= limit {
        return;
    }
    let Ok(rd) = fs::read_dir(dir) else {
        return;
    };
    for entry in rd.flatten() {
        if hits.len() >= limit {
            break;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) || name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            walk_search(root, &path, query, hits, limit);
            continue;
        }
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        if text.len() > 400_000 {
            continue;
        }
        for (i, line) in text.lines().enumerate() {
            if line.contains(query) {
                let rel = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();
                hits.push(SearchHit {
                    path: rel,
                    line: i + 1,
                    text: line.chars().take(200).collect(),
                });
                if hits.len() >= limit {
                    break;
                }
            }
        }
    }
}

#[tauri::command]
pub fn workspace_context(workspace: String) -> Result<WorkspaceContext, String> {
    let root = PathBuf::from(&workspace)
        .canonicalize()
        .map_err(|e| format!("workspace inválido: {e}"))?;
    if !root.is_dir() {
        return Err("workspace não é pasta".into());
    }

    let name = root
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| root.to_string_lossy().to_string());

    let mut tree = String::new();
    let mut budget = 45;
    append_tree(&root, "", 0, 1, &mut tree, &mut budget);

    let mut overview = String::new();
    for rel in [
        "README.md",
        "readme.md",
        "package.json",
        "Cargo.toml",
        "requirements.txt",
    ] {
        if let Some(snippet) = read_snippet(&root, rel, 900) {
            overview.push_str(&snippet);
            overview.push('\n');
            break; // só o primeiro manifesto relevante
        }
    }

    Ok(WorkspaceContext {
        path: root.to_string_lossy().to_string(),
        name,
        tree,
        overview,
    })
}
