# Arquitetura

O IA-PTX tem duas superfícies que compartilham a mesma configuração do modelo Groq.

```
IA-PTX/
├── main.py + src/          # Chat CLI (Python + SDK groq)
└── desktop/                # IDE Desktop (Tauri 2)
    ├── src/                # UI React + TypeScript
    └── src-tauri/          # Backend Rust (FS + HTTP Groq + store de chats)
```

## Fluxo de dados do Desktop

1. A UI (`AgentPanel`) envia prompts do usuário para `runAgent`.
2. `runAgent` faz o loop: chama `agent_turn` (Rust) → executa tools localmente → anexa resultados.
3. O Rust `agent_turn` chama a Groq Chat Completions com function tools.
4. As tools (`list_dir`, `read_file`, `write_file`, `str_replace`, `search_files`) rodam em Rust no workspace aberto (sandbox de path).
5. As sessões de chat ficam em `{workspace}/.ia-ptx/chats.json`.

## Configuração

| Variável | Finalidade | Padrão |
|----------|------------|--------|
| `GROQ_API_KEY` | Chave da API Groq | obrigatória |
| `GROQ_MODEL` | ID do modelo | `openai/gpt-oss-120b` |
| `GROQ_MAX_COMPLETION_TOKENS` | Máximo de tokens de saída | `65536` |

Carregadas do `.env` na raiz do projeto (CLI) e do mesmo arquivo relativo ao crate Tauri (`../.env`).

## Modelo de segurança

- Acesso a arquivos restrito à raiz do workspace selecionado.
- Extensões tipicamente binárias são bloqueadas no `read_file` do agent.
- API keys devem ficar só no `.env` (gitignored).
