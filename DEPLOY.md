# Deploy na VPS

O que este projeto contém:
- `index.js`, `src/` → a biblioteca whatsapp-web.js (não precisa mexer).
- `bot/` → **o chatbot** (o que estava faltando): configuração, catálogo,
  máquina de estados da conversa e o entry point (`bot/index.js`).
- `data/leads.json` → onde os leads coletados são salvos.
- `.wwebjs_auth/` → sessão do WhatsApp (gerada automaticamente no primeiro login).

Duas formas de rodar na VPS: **Docker** (recomendado, mais previsível) ou
**PM2** (mais simples, direto na máquina).

---

## Opção A — Docker (recomendado)

Requisitos na VPS: Docker e Docker Compose instalados.

```bash
# 1. Envie o projeto para a VPS (git clone, scp ou rsync)
# 2. Dentro da pasta do projeto:
cp .env.bot.example .env
nano .env            # preencha COMPANY_NAME, ADMIN_NUMBERS etc.

# 3. Suba o container
docker compose up -d --build

# 4. Veja o QR Code para conectar o WhatsApp
docker compose logs -f bot
```

Escaneie o QR Code com o WhatsApp (Aparelhos conectados → Conectar um
aparelho). A sessão fica salva em `./.wwebjs_auth` — se o container reiniciar,
não será necessário escanear de novo.

Comandos úteis:
```bash
docker compose logs -f bot     # acompanhar logs
docker compose restart bot     # reiniciar o bot
docker compose down            # parar
docker compose up -d --build   # atualizar após alterar o código
```

---

## Opção B — PM2 (sem Docker)

Requisitos na VPS (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install -y nodejs npm chromium \
    ca-certificates fonts-liberation
sudo npm install -g pm2
```

Depois:
```bash
cd /caminho/do/projeto
cp .env.bot.example .env
nano .env
# defina PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium no .env

npm install --omit=dev
pm2 start ecosystem.config.js
pm2 logs whatsapp-bot     # ver o QR Code e acompanhar logs
pm2 save                  # persistir a lista de processos
pm2 startup               # gera o comando para o PM2 iniciar sozinho no boot
                           # (copie e rode o comando que ele imprimir)
```

Comandos úteis:
```bash
pm2 restart whatsapp-bot
pm2 stop whatsapp-bot
pm2 logs whatsapp-bot --lines 100
```

---

## Checklist antes de colocar em produção
- [ ] Preencher `ADMIN_NUMBERS` no `.env` com o(s) número(s) que devem
      receber os leads.
- [ ] Completar `bot/catalog.js` com os serviços reais (hoje só tem os
      de exemplo).
- [ ] Fazer backup periódico de `data/leads.json` e `.wwebjs_auth/`
      (a sessão do WhatsApp fica ali — perdê-la exige escanear o QR de novo).
- [ ] Se usar Docker, garanta que a VPS tenha pelo menos ~1 GB de RAM livre
      (o Chromium consome memória).
- [ ] Testar o fluxo completo mandando uma mensagem de outro número antes
      de divulgar o contato para clientes.

## Solução de problemas comuns
- **Chromium não abre / erro de sandbox**: já resolvido nos args
  `--no-sandbox --disable-setuid-sandbox` em `bot/index.js` — necessários
  porque VPS geralmente roda como root e sem sandbox de usuário.
- **Bot trava ou desconecta sozinho após um tempo**: o `bot/index.js` já
  tenta reconectar automaticamente após 10s quando recebe o evento
  `disconnected`. Se persistir, aumente a RAM da VPS ou o `shm_size` no
  `docker-compose.yml`.
- **Perdeu a sessão e precisa logar de novo**: apague a pasta
  `.wwebjs_auth/` e reinicie o bot para gerar um novo QR Code.
