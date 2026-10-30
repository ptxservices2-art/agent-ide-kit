# IA-PTX Desktop

IDE estilo Cursor (Tauri 2 + React + Monaco) com **Agent** que lê/edita arquivos via Groq.

## Dev

```bat
cd apps\IA-PTX\desktop
npm install
npm run tauri dev
```

Requer `GROQ_API_KEY` em `../.env`.

## O que tem

- Activity bar + Explorer + abas + status bar (visual VS Code/Cursor)
- Agent com tools: `list_dir`, `read_file`, `write_file`, `search_files`
- Ao editar, arquivos abrem/atualizam no editor automaticamente

## Uso

1. Abrir pasta (ícone na activity bar ou botão no Explorer)
2. Pedir no Agent: ex. `crie um arquivo hello.py com uma função soma`
3. Ver tool calls e arquivos alterados no painel
