# Política de Segurança

## Reportar uma vulnerabilidade

Se encontrar um problema de segurança no IA-PTX, abra um **advisory privado** no GitHub
ou contate os mantenedores. **Não** abra uma issue pública com detalhes de exploit.

## Segredos

- Nunca faça commit de arquivos `.env` ou API keys.
- Use o `.env.example` apenas como modelo.
- Se uma chave vazar, rotacione imediatamente no [Console da Groq](https://console.groq.com/).

## Permissões do agent local

O agent do desktop pode ler e escrever arquivos **dentro do workspace aberto**.
Trate prompts não confiáveis com cuidado — o modelo pode pedir edições via tools.
