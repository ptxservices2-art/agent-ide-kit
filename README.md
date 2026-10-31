# agent-ide-kit

> **Modelo de IDE com IA** — kit open source estilo Cursor para clonar, adaptar e plugar a API que quiser.

**agent-ide-kit** é um kit completo de IDE + agent de código (padrão: [Groq](https://groq.com/)), com:

- **CLI** de chat no terminal (Python)
- **IDE desktop** (Tauri 2 + React + Monaco) com agent que lê, busca e edita arquivos do workspace

Serve como **ponto de partida**: fork, troca a API key / provedor e customiza a UI. Funciona com OpenAI, Gemini, OpenRouter, DeepSeek, Azure e outros — veja [Usar outros modelos / APIs](#usar-outros-modelos--apis).

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
- Chats persistentes por workspace (`.agent-ide-kit/chats.json`)
- Novo chat sem apagar o histórico
- Barra de revisão: desfazer / salvar / revisar edições do agent
- UI dark no estilo Cursor

---

## Estrutura do repositório

```text
agent-ide-kit/
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
git clone https://github.com/ptxservices2-art/agent-ide-kit.git
cd agent-ide-kit

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
| `GROQ_API_KEY` | Chave da API Groq (obrigatória no setup padrão) |
| `GROQ_MODEL` | ID do modelo (padrão `openai/gpt-oss-120b`) |
| `GROQ_MAX_COMPLETION_TOKENS` | Máximo de tokens de saída (padrão `65536`) |

---

## Usar outros modelos / APIs

O **agent-ide-kit** **não está preso à Groq**. O desktop fala o protocolo **OpenAI Chat Completions** (`POST …/v1/chat/completions` + `Authorization: Bearer …` + tools no formato function calling). Qualquer provedor compatível (ou com endpoint OpenAI-compatible) encaixa com pouca mudança.

Exemplos: **OpenAI**, **Google Gemini** (endpoint OpenAI-compatible), **OpenRouter**, **DeepSeek**, **Azure OpenAI**, **Together**, **Fireworks**, etc.

### Onde mexer

| Camada | Arquivo | O que mudar |
|--------|---------|-------------|
| Desktop (agent) | `desktop/src-tauri/src/ai.rs` | URL da API, nome da env da key, modelo, e campos extras do body se o provedor exigir |
| CLI | `src/config.py` + `src/groq_client.py` | Trocar SDK / base URL / key / modelo |
| Env | `.env` / `.env.example` | Novas variáveis (`OPENAI_API_KEY`, `GEMINI_API_KEY`, …) |

### Desktop — passo a passo

1. No `.env`, troque (ou adicione) a chave e o modelo:

```env
# Exemplo OpenAI
OPENAI_API_KEY=sk-sua_chave
GROQ_MODEL=gpt-4.1
# ou renomeie as envs no código para OPENAI_* / LLM_*
```

2. Em `ai.rs`, ajuste:

- `api_key()` → ler `OPENAI_API_KEY` (ou a env do provedor)
- `model()` → id do modelo (ex.: `gpt-4.1`, `gemini-2.0-flash`, `deepseek-chat`)
- URL do `.post(...)` atual:

```text
https://api.groq.com/openai/v1/chat/completions
```

| Provedor | Endpoint típico |
|----------|-----------------|
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| Gemini (compatível OpenAI) | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` |
| Groq (padrão) | `https://api.groq.com/openai/v1/chat/completions` |

3. Mantenha o formato das **tools** (`type: function`) — a maioria dos provedores OpenAI-compatible aceita. Se o provedor não tiver function calling, o agent do desktop perde as tools de arquivo (aí é preciso adaptar o loop em `runAgent.ts`).

4. Remova ou ignore campos específicos da Groq no body (ex.: `reasoning_effort`, se o outro provedor rejeitar).

5. Rebuild / reinicie: `npm run tauri dev`.

### CLI (Python) — passo a passo

Hoje o CLI usa o SDK `groq`. Para outro provedor:

1. Instale o SDK correspondente, ex.:

```bash
pip install openai          # OpenAI, OpenRouter, DeepSeek, Gemini OpenAI-compat…
# ou
pip install google-genai    # Gemini nativo
```

2. Em `src/config.py`, leia a nova key (`OPENAI_API_KEY`, `GEMINI_API_KEY`, …) e o modelo.

3. Em `src/groq_client.py`, troque o cliente. Exemplo com SDK OpenAI apontando para outro host:

```python
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://api.openai.com/v1",  # ou URL do provedor
)
# client.chat.completions.create(model=..., messages=...)
```

Para Gemini via endpoint OpenAI-compatible:

```python
client = OpenAI(
    api_key=os.getenv("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)
```

### Dicas

- Prefira modelos com **function calling** se quiser o agent editando arquivos.
- Limites de TPM/contexto mudam por provedor — ajuste prompts e tamanho dos `write_file`.
- Não commite a nova API key; só o `.env.example` com placeholders.
- Ideal futuro: uma env única `LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL` (contribuições bem-vindas).

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

MIT © contribuidores agent-ide-kit — veja [LICENSE](LICENSE).

---

## Agradecimentos

- [Groq](https://groq.com/)
- [Tauri](https://tauri.app/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Vite](https://vite.dev/) + [React](https://react.dev/)
