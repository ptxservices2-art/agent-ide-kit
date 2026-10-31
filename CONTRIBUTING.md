# Contribuindo para o agent-ide-kit

Obrigado por contribuir.

## Ambiente de desenvolvimento

### CLI (Python)

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# edite o .env com sua GROQ_API_KEY
python main.py
```

### IDE Desktop (Tauri)

Requisitos: Node.js 20+, Rust stable e dependências de webview do Tauri 2.

```bash
cd desktop
npm install
npm run tauri dev
```

## Diretrizes

1. Não commite segredos (`.env`, chaves, tokens).
2. Mantenha mudanças focadas — uma feature/correção por PR quando possível.
3. Siga o estilo do código existente (Rust 2021, React + TypeScript, Python 3.11+).
4. Atualize a documentação quando o comportamento mudar.

## Pull requests

- Descreva **o quê** e **por quê**.
- Inclua um plano de teste curto (CLI / desktop).
- Linke issues relacionadas, se houver.
