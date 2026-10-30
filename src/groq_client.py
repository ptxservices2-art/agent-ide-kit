from __future__ import annotations

from typing import Any

from groq import Groq

from .config import GROQ_API_KEY, GROQ_MAX_COMPLETION_TOKENS, GROQ_MODEL, SYSTEM_PROMPT

DEFAULT_TOOLS: list[dict[str, Any]] = [
    {"type": "code_interpreter"},
    {"type": "browser_search"},
]


class IAPtx:
    """Cliente da IA-PTX via Groq."""

    def __init__(
        self,
        *,
        model: str | None = None,
        system_prompt: str | None = None,
        use_tools: bool = True,
        temperature: float = 1.0,
        max_completion_tokens: int | None = None,
        reasoning_effort: str = "medium",
    ) -> None:
        self.client = Groq(api_key=GROQ_API_KEY)
        self.model = model or GROQ_MODEL
        self.system_prompt = system_prompt or SYSTEM_PROMPT
        self.use_tools = use_tools
        self.temperature = temperature
        self.max_completion_tokens = (
            max_completion_tokens
            if max_completion_tokens is not None
            else GROQ_MAX_COMPLETION_TOKENS
        )
        self.reasoning_effort = reasoning_effort
        self.history: list[dict[str, str]] = [
            {"role": "system", "content": self.system_prompt}
        ]

    def reset(self) -> None:
        self.history = [{"role": "system", "content": self.system_prompt}]

    def _build_kwargs(self, stream: bool) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": self.history,
            "temperature": self.temperature,
            "max_completion_tokens": self.max_completion_tokens,
            "top_p": 1,
            "reasoning_effort": self.reasoning_effort,
            "stream": stream,
            "stop": None,
        }
        if self.use_tools:
            kwargs["tools"] = DEFAULT_TOOLS
        return kwargs

    def ask(self, user_message: str) -> str:
        self.history.append({"role": "user", "content": user_message})

        completion = self.client.chat.completions.create(**self._build_kwargs(stream=False))
        message = completion.choices[0].message
        content = (message.content or "").strip()

        if not content and getattr(message, "tool_calls", None):
            content = f"[ferramentas invocadas] {message.tool_calls}"

        self.history.append({"role": "assistant", "content": content or "(sem resposta)"})
        return content or "(sem resposta)"

    def ask_stream(self, user_message: str):
        """Gera tokens da resposta em streaming."""
        self.history.append({"role": "user", "content": user_message})

        stream = self.client.chat.completions.create(**self._build_kwargs(stream=True))
        parts: list[str] = []

        for chunk in stream:
            delta = chunk.choices[0].delta
            piece = delta.content or ""
            if piece:
                parts.append(piece)
                yield piece

        full = "".join(parts).strip() or "(sem resposta)"
        self.history.append({"role": "assistant", "content": full})
