# Bot de qualificação de leads

Chatbot que conduz o cliente por um fluxo guiado (nome → empresa → cidade →
plano de interesse → serviço → objetivo → melhor horário → mensagem) e salva
o resultado em `data/leads.json`, já classificado por temperatura/prioridade,
notificando automaticamente os atendentes configurados.

## Arquivos
- `config.js` — lê as variáveis de ambiente (`.env`).
- `catalog.js` — catálogo de serviços/planos (edite aqui).
- `leadStore.js` — classificação e persistência dos leads.
- `conversation.js` — a conversa em si (perguntas, menu, validações).
- `index.js` — conecta ao WhatsApp e liga tudo.

## Rodar localmente
```bash
cp ../.env.bot.example ../.env   # ou .env na raiz do projeto
npm install
npm start
```
Escaneie o QR Code exibido no terminal.

## Personalizar
- Edite `catalog.js` com os serviços reais.
- Ajuste os textos em `conversation.js` (funções `greetingText`, `menuText`
  etc.) para o tom de voz da sua empresa.
- Todas as configurações de negócio (nome da empresa, números de admin,
  horário de atendimento) ficam no `.env` — veja `DEPLOY.md` na raiz do
  projeto para o passo a passo de deploy em VPS.
