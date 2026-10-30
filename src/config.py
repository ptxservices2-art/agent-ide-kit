import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_MAX_COMPLETION_TOKENS = int(os.getenv("GROQ_MAX_COMPLETION_TOKENS", "65536"))

SYSTEM_PROMPT = (
    "Você é a IA-PTX, assistente do ecossistema PTX. "
    "Responda em português brasileiro, de forma clara e objetiva. "
    "Quando usar ferramentas (código ou busca), explique o raciocínio de forma útil."
)

if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY não definida. Copie .env.example para .env e preencha a chave."
    )
