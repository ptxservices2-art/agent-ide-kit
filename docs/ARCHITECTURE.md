# Architecture

IA-PTX has two surfaces that share the same Groq model configuration.

```
IA-PTX/
├── main.py + src/          # CLI chat (Python + groq SDK)
└── desktop/                # Desktop IDE (Tauri 2)
    ├── src/                # React + TypeScript UI
    └── src-tauri/          # Rust backend (FS + Groq HTTP + chat store)
```

## Desktop data flow

1. UI (`AgentPanel`) sends user prompts to `runAgent`.
2. `runAgent` loops: call `agent_turn` (Rust) → execute tools locally → append results.
3. Rust `agent_turn` calls Groq Chat Completions with function tools.
4. Tools (`list_dir`, `read_file`, `write_file`, `str_replace`, `search_files`) run in Rust against the opened workspace (path sandbox).
5. Chat sessions persist under `{workspace}/.ia-ptx/chats.json`.

## Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `GROQ_API_KEY` | Groq API key | required |
| `GROQ_MODEL` | Model id | `openai/gpt-oss-120b` |
| `GROQ_MAX_COMPLETION_TOKENS` | Max output tokens | `65536` |

Loaded from `apps/IA-PTX/.env` (CLI) and the same file relative to the Tauri crate (`../.env`).

## Security model

- File access is restricted to the selected workspace root.
- Binary-like extensions are blocked from agent `read_file`.
- API keys must stay in `.env` (gitignored).
