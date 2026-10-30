# IA-PTX

**IA-PTX** is an AI coding assistant powered by [Groq](https://groq.com/), with:

- a **CLI chat** (Python)
- a **desktop IDE** (Tauri 2 + React + Monaco) with an agent that can read/search/edit files in your workspace

Inspired by modern AI editors (Cursor-like UX): explorer, tabs, agent panel, chat history, and review bar for file changes.

> **Version:** v1.0.0  
> **License:** MIT

---

## Features

### CLI
- Interactive chat in the terminal
- Groq chat completions (`openai/gpt-oss-120b` by default)
- Optional compound tools (`code_interpreter`, `browser_search`)

### Desktop IDE
- Custom title bar + activity bar + explorer (icons, git badges)
- Monaco editor with multi-tabs
- **Agent** with tools:
  - `list_dir` · `read_file` · `write_file` · `str_replace` · `search_files`
- Persistent chats per workspace (`.ia-ptx/chats.json`)
- New chat without deleting history
- Review bar: undo / save / review agent edits
- Dark UI with Cursor-inspired layout

---

## Repository structure

```text
IA-PTX/
├── main.py                 # CLI entrypoint
├── src/                    # Python Groq client
├── requirements.txt
├── .env.example
├── docs/
│   └── ARCHITECTURE.md
└── desktop/                # Tauri IDE
    ├── src/                # React UI
    └── src-tauri/          # Rust backend
```

---

## Requirements

| Component | Requirement |
|-----------|-------------|
| Python CLI | Python 3.11+ |
| Desktop | Node.js 20+, Rust (stable), Tauri 2 prerequisites |
| API | Groq account + API key |

Tauri prerequisites: see [Tauri getting started](https://v2.tauri.app/start/).

---

## Quick start

### 1) Clone & configure

```bash
git clone https://github.com/ptxservices2-art/IA-PTX.git
cd IA-PTX

cp .env.example .env
# Edit .env and set GROQ_API_KEY
```

```env
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=openai/gpt-oss-120b
GROQ_MAX_COMPLETION_TOKENS=65536
```

> Never commit your real `.env`.

### 2) CLI

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python main.py
```

Commands in chat: `/sair` · `/limpar` · `/tools`

### 3) Desktop IDE

```bash
cd desktop
npm install
npm run tauri dev
```

Production build:

```bash
npm run tauri build
```

---

## Usage tips (Agent)

1. Open a project folder in the IDE.
2. Ask focused tasks, e.g. *“add dark theme to style.css using str_replace”*.
3. Use **+** for a new chat (old chats remain in history).
4. When files change, use **Salvar** / **Desfazer** / **Revisar** in the review bar.

Large binary dumps (`.dat`, `.apk`, …) are blocked from agent reads on purpose.

---

## Configuration reference

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Required Groq API key |
| `GROQ_MODEL` | Model id (default `openai/gpt-oss-120b`) |
| `GROQ_MAX_COMPLETION_TOKENS` | Max completion tokens (default `65536`) |

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

---

## Roadmap (post-v1)

- [ ] Streaming responses in the agent panel
- [ ] Diff view (Accept / Reject hunks)
- [ ] Integrated terminal
- [ ] Multi-model picker in the UI

---

## Security

- Rotate any key that was pasted into chat or committed by mistake.
- The agent can modify files inside the opened workspace — review changes before shipping.

---

## License

MIT © IA-PTX contributors — see [LICENSE](LICENSE).

---

## Acknowledgments

- [Groq](https://groq.com/)
- [Tauri](https://tauri.app/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Vite](https://vite.dev/) + [React](https://react.dev/)
