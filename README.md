# IA-PTX

**IA-PTX** é um assistente de programação com IA via [Groq](https://groq.com/), com:

- **CLI** de chat no terminal (Python)
- **IDE desktop** (Tauri 2 + React + Monaco) com agent que lê, busca e edita arquivos do workspace

Interface inspirada em editores modernos com IA (estilo Cursor): explorer, abas, painel do agent, histórico de chats e barra de revisão de mudanças.

> **Versão:** v1.0.0  
> **Licença:** MIT

---

## Funcionalidades

### CLI
- Chat interativo no terminal
- Completions da Groq (`openai/gpt-oss-120b` por padrão)
- Tools compound opcionais (`code_interpreter`, `browser_search`)

### IDE Desktop
- Title bar customizada + activity bar + explorer (ícones, badges git)
- Editor Monaco com múltiplas abas
- **Agent** com tools:
  - `list_dir` · `read_file` · `write_file` · `str_replace` · `search_files`
- Chats persistentes por workspace (`.ia-ptx/chats.json`)
- Novo chat sem apagar o histórico
- Barra de revisão: desfazer / salvar / revisar edições do agent
- UI dark no estilo Cursor

---

## Estrutura do repositório

```text
IA-PTX/
├── main.py                 # Entrada do CLI
├── src/                    # Cliente Python da Groq
├── requirements.txt
├── .env.example
├── docs/
│   └── ARCHITECTURE.md
└── desktop/                # IDE Tauri
    ├── src/                # UI React
    └── src-tauri/          # Backend Rust
```

---

## Requisitos

| Componente | Requisito |
|------------|-----------|
| CLI Python | Python 3.11+ |
| Desktop | Node.js 20+, Rust (stable), pré-requisitos do Tauri 2 |
| API | Conta Groq + API key |

Pré-requisitos do Tauri: veja o [guia oficial](https://v2.tauri.app/start/).

---

## Início rápido

### 1) Clonar e configurar

```bash
git clone https://github.com/ptxservices2-art/IA-PTX.git
cd IA-PTX

cp .env.example .env
# Edite o .env e coloque sua GROQ_API_KEY
```

```env
GROQ_API_KEY=gsk_sua_chave_aqui
GROQ_MODEL=openai/gpt-oss-120b
GROQ_MAX_COMPLETION_TOKENS=65536
```

> Nunca faça commit do seu `.env` real.

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

Comandos no chat: `/sair` · `/limpar` · `/tools`

### 3) IDE Desktop

```bash
cd desktop
npm install
npm run tauri dev
```

Build de produção:

```bash
npm run tauri build
```

---

## Dicas de uso (Agent)

1. Abra uma pasta de projeto na IDE.
2. Peça tarefas objetivas, ex.: *“adicione tema dark no style.css usando str_replace”*.
3. Use **+** para novo chat (os antigos ficam no histórico).
4. Quando arquivos mudarem, use **Salvar** / **Desfazer** / **Revisar** na barra de revisão.

Arquivos binários (`.dat`, `.apk`, …) são bloqueados de propósito na leitura do agent.

---

## Referência de configuração

| Variável | Descrição |
|----------|-----------|
| `GROQ_API_KEY` | Chave da API Groq (obrigatória) |
| `GROQ_MODEL` | ID do modelo (padrão `openai/gpt-oss-120b`) |
| `GROQ_MAX_COMPLETION_TOKENS` | Máximo de tokens de saída (padrão `65536`) |

---

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Como contribuir](CONTRIBUTING.md)
- [Segurança](SECURITY.md)

---

## Roadmap (pós-v1)

- [ ] Streaming de respostas no painel do agent
- [ ] Diff view (Aceitar / Recusar hunks)
- [ ] Terminal integrado
- [ ] Seletor de modelo na UI

---

## Segurança

- Rotacione qualquer chave que tenha sido colada em chat ou commitada por engano.
- O agent pode alterar arquivos dentro do workspace aberto — revise as mudanças antes de publicar.

---

## Licença

MIT © contribuidores IA-PTX — veja [LICENSE](LICENSE).

---

## Agradecimentos

- [Groq](https://groq.com/)
- [Tauri](https://tauri.app/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Vite](https://vite.dev/) + [React](https://react.dev/)
