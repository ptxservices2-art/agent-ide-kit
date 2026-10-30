# Contributing to IA-PTX

Thanks for contributing.

## Development setup

### CLI (Python)

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# edit .env with your GROQ_API_KEY
python main.py
```

### Desktop IDE (Tauri)

Requirements: Node.js 20+, Rust stable, OS webview deps for Tauri 2.

```bash
cd desktop
npm install
npm run tauri dev
```

## Guidelines

1. Do not commit secrets (`.env`, keys, tokens).
2. Keep changes focused — one feature/fix per PR when possible.
3. Match existing code style (Rust 2021, React + TypeScript, Python 3.11+).
4. Update docs when behavior changes.

## Pull requests

- Describe **what** and **why**.
- Include a short test plan (CLI / desktop).
- Link related issues if any.
