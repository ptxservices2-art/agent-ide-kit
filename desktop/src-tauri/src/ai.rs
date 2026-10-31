use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::path::PathBuf;
use std::sync::OnceLock;

static HTTP: OnceLock<reqwest::Client> = OnceLock::new();

fn http() -> &'static reqwest::Client {
    HTTP.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(180))
            .build()
            .expect("cliente HTTP")
    })
}

fn load_env() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for path in [
        manifest.join("../.env"),
        manifest.join("../../.env"),
        PathBuf::from(".env"),
    ] {
        if path.exists() {
            let _ = dotenvy::from_path(&path);
        }
    }
}

fn api_key() -> Result<String, String> {
    load_env();
    env::var("GROQ_API_KEY")
        .map_err(|_| "GROQ_API_KEY não definida. Coloque no .env na raiz do projeto.".into())
}

fn model() -> String {
    load_env();
    env::var("GROQ_MODEL").unwrap_or_else(|_| "openai/gpt-oss-120b".into())
}

fn max_completion_tokens() -> u32 {
    load_env();
    env::var("GROQ_MAX_COMPLETION_TOKENS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(65536)
}

fn agent_tools() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "list_dir",
                "description": "Lista arquivos e pastas de um diretório do workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Caminho relativo ao workspace. Vazio = raiz."
                        }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Lê o conteúdo de um arquivo de texto do workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "write_file",
                "description": "Cria/sobrescreve arquivo PEQUENO (prefira <= 2000 chars). Para CSS/HTML grandes: escreva um esqueleto curto e depois use str_replace em pedaços.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "content": { "type": "string", "description": "Conteúdo do arquivo (curto)" }
                    },
                    "required": ["path", "content"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "str_replace",
                "description": "Substitui um trecho único old_string por new_string num arquivo existente. Use para edições e para ir montando arquivos grandes em pedaços.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "old_string": { "type": "string" },
                        "new_string": { "type": "string" }
                    },
                    "required": ["path", "old_string", "new_string"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "search_files",
                "description": "Busca texto nos arquivos do workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" },
                        "path": { "type": "string" }
                    },
                    "required": ["query"]
                }
            }
        }
    ])
}

const AGENT_SYSTEM: &str = "Você é o Agent do agent-ide-kit, coding agent numa IDE.\n\
Responda em português, objetivo.\n\
Tools: list_dir, read_file, write_file, str_replace, search_files.\n\
Regras:\n\
- Prefira str_replace para editar arquivos existentes.\n\
- write_file ok para arquivos novos ou rewrites; se o JSON da tool falhar, continue com str_replace.\n\
- Não leia binários (.dat/.apk/.so/.pyc).\n\
- Caminhos relativos. Ao terminar, texto sem tools.";

fn clip(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let cut: String = s.chars().take(max).collect();
        format!("{cut}\n…(cortado)")
    }
}

fn args_to_string(args: &Value) -> String {
    if let Some(s) = args.as_str() {
        s.to_string()
    } else {
        args.to_string()
    }
}

/// Tenta recuperar tool call de failed_generation da Groq (JSON truncado/quebrado).
fn recover_tool_from_failed(failed: &str) -> Option<ToolCall> {
    let trimmed = failed.trim();
    // 1) JSON válido completo
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        let name = v.get("name")?.as_str()?.to_string();
        let args = v.get("arguments")?;
        return Some(ToolCall {
            id: "recovered_0".into(),
            call_type: Some("function".into()),
            function: ToolFunction {
                name,
                arguments: args_to_string(args),
            },
        });
    }

    // 2) Extrai name + path + content mesmo se truncou no meio
    let name = {
        let key = "\"name\"";
        let i = trimmed.find(key)?;
        let after = &trimmed[i + key.len()..];
        let start = after.find('"')? + 1;
        let rest = &after[start..];
        let end = rest.find('"')?;
        rest[..end].to_string()
    };

    let path = {
        let key = "\"path\"";
        let i = trimmed.find(key)?;
        let after = &trimmed[i + key.len()..];
        let start = after.find('"')? + 1;
        let rest = &after[start..];
        let end = rest.find('"')?;
        rest[..end].to_string()
    };

    // content: pega do primeiro " após "content" até o fim, desfaz escapes comuns
    let content_key = "\"content\"";
    let i = trimmed.find(content_key)?;
    let after = &trimmed[i + content_key.len()..];
    let start = after.find('"')? + 1;
    let mut raw = after[start..].to_string();
    // remove fechos quebrados no final
    while raw.ends_with('"') || raw.ends_with('}') || raw.ends_with(',') {
        raw.pop();
    }
    let content = raw
        .replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace("\\\"", "\"")
        .replace("\\/", "/")
        .replace("\\u0026", "&");

    if name.is_empty() || path.is_empty() || content.len() < 20 {
        return None;
    }

    let arguments = json!({ "path": path, "content": content }).to_string();
    Some(ToolCall {
        id: "recovered_trunc".into(),
        call_type: Some("function".into()),
        function: ToolFunction { name, arguments },
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentChatMessage {
    pub role: String,
    pub content: Option<String>,
    pub tool_call_id: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: Option<String>,
    pub function: ToolFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTurnRequest {
    pub messages: Vec<AgentChatMessage>,
    pub ide_context: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTurnResponse {
    pub content: Option<String>,
    pub tool_calls: Vec<ToolCall>,
    pub model: String,
    pub recovered: bool,
}

#[tauri::command]
pub async fn agent_turn(req: AgentTurnRequest) -> Result<AgentTurnResponse, String> {
    let key = api_key()?;
    let model_name = model();

    let ctx = req
        .ide_context
        .as_deref()
        .map(|c| clip(c, 12_000))
        .unwrap_or_default();
    let system = if ctx.trim().is_empty() {
        AGENT_SYSTEM.to_string()
    } else {
        format!("{AGENT_SYSTEM}\n\n--- CONTEXTO ---\n{ctx}")
    };

    let start = req.messages.len().saturating_sub(40);
    let recent = &req.messages[start..];

    let mut api_messages: Vec<Value> = Vec::with_capacity(recent.len() + 1);
    api_messages.push(json!({ "role": "system", "content": system }));

    for m in recent {
        let mut obj = json!({ "role": m.role });
        if let Some(c) = &m.content {
            let max = if m.role == "tool" { 20_000 } else { 30_000 };
            obj["content"] = json!(clip(c, max));
        } else if m.role != "assistant" || m.tool_calls.is_none() {
            obj["content"] = json!("");
        }
        if let Some(id) = &m.tool_call_id {
            obj["tool_call_id"] = json!(id);
        }
        if let Some(name) = &m.name {
            obj["name"] = json!(name);
        }
        if let Some(calls) = &m.tool_calls {
            let mapped: Vec<Value> = calls
                .iter()
                .map(|c| {
                    json!({
                        "id": c.id,
                        "type": c.call_type.clone().unwrap_or_else(|| "function".into()),
                        "function": {
                            "name": c.function.name,
                            "arguments": clip(&c.function.arguments, 60_000),
                        }
                    })
                })
                .collect();
            obj["tool_calls"] = Value::Array(mapped);
        }
        api_messages.push(obj);
    }

    let max_tokens = max_completion_tokens();
    let body = json!({
        "model": model_name,
        "messages": api_messages,
        "temperature": 1,
        "max_completion_tokens": max_tokens,
        "top_p": 1,
        "reasoning_effort": "medium",
        "stream": false,
        "stop": null,
        "tools": agent_tools(),
        "tool_choice": "auto",
    });

    let res = http()
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(&key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("falha de rede: {e}"))?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        // Recupera tool call truncada (erro clássico write_file enorme)
        if let Ok(err_json) = serde_json::from_str::<Value>(&text) {
            if let Some(failed) = err_json
                .pointer("/error/failed_generation")
                .and_then(|v| v.as_str())
            {
                if let Some(call) = recover_tool_from_failed(failed) {
                    return Ok(AgentTurnResponse {
                        content: Some(
                            "Tool call veio truncada da API — recuperei o que deu e vou aplicar; complete o resto com str_replace se faltar.".into(),
                        ),
                        tool_calls: vec![call],
                        model: model_name,
                        recovered: true,
                    });
                }
            }
            let code = err_json
                .pointer("/error/code")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if code == "tool_use_failed" {
                return Err(
                    "A tool call da Groq quebrou (JSON inválido). Peça de novo em partes menores — use str_replace.".into(),
                );
            }
        }
        return Err(format!("Groq {status}: {text}"));
    }

    let parsed: Value =
        serde_json::from_str(&text).map_err(|e| format!("JSON inválido: {e}\n{text}"))?;

    let message = parsed
        .pointer("/choices/0/message")
        .cloned()
        .ok_or_else(|| format!("resposta sem message: {text}"))?;

    let content = message
        .get("content")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let mut tool_calls = Vec::new();
    if let Some(arr) = message.get("tool_calls").and_then(|v| v.as_array()) {
        for item in arr {
            let id = item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("call")
                .to_string();
            let name = item
                .pointer("/function/name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let arguments = item
                .pointer("/function/arguments")
                .map(|v| {
                    if let Some(s) = v.as_str() {
                        s.to_string()
                    } else {
                        v.to_string()
                    }
                })
                .unwrap_or_else(|| "{}".into());
            if !name.is_empty() {
                tool_calls.push(ToolCall {
                    id,
                    call_type: Some("function".into()),
                    function: ToolFunction { name, arguments },
                });
            }
        }
    }

    Ok(AgentTurnResponse {
        content,
        tool_calls,
        model: model_name,
        recovered: false,
    })
}

#[tauri::command]
pub fn ai_status() -> Result<serde_json::Value, String> {
    let key_ok = api_key().is_ok();
    Ok(json!({
        "ready": key_ok,
        "model": model(),
    }))
}
