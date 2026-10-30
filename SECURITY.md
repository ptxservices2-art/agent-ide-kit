# Security Policy

## Reporting a vulnerability

If you find a security issue in IA-PTX, please open a **private** security advisory on GitHub
or contact the maintainers. Do **not** open a public issue with exploit details.

## Secrets

- Never commit `.env` files or API keys.
- Use `.env.example` as a template only.
- If a key is exposed, rotate it immediately in the [Groq Console](https://console.groq.com/).

## Local agent permissions

The desktop agent can read and write files **inside the opened workspace**.
Treat untrusted prompts carefully — the model can request file edits via tools.
