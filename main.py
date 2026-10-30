"""
IA-PTX — chat interativo com a API Groq.

Comandos:
  /sair   encerra
  /limpar limpa o histórico da conversa
  /tools  liga/desliga code_interpreter + browser_search
"""

from __future__ import annotations

import sys

from src.groq_client import IAPtx


def main() -> int:
    ia = IAPtx(use_tools=True)

    print("=" * 50)
    print("  IA-PTX  |  modelo:", ia.model)
    print("  Digite sua mensagem. /sair para encerrar.")
    print("=" * 50)

    while True:
        try:
            user = input("\nVocê: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nAté logo.")
            return 0

        if not user:
            continue

        cmd = user.lower()
        if cmd in {"/sair", "/exit", "/quit"}:
            print("Até logo.")
            return 0
        if cmd in {"/limpar", "/clear"}:
            ia.reset()
            print("Histórico limpo.")
            continue
        if cmd == "/tools":
            ia.use_tools = not ia.use_tools
            estado = "ligadas" if ia.use_tools else "desligadas"
            print(f"Ferramentas {estado}.")
            continue

        print("\nIA-PTX: ", end="", flush=True)
        try:
            for piece in ia.ask_stream(user):
                print(piece, end="", flush=True)
            print()
        except Exception as exc:  # noqa: BLE001 — feedback amigável no CLI
            # remove a última mensagem do user se a chamada falhou
            if ia.history and ia.history[-1].get("role") == "user":
                ia.history.pop()
            print(f"\n[erro] {exc}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
