FROM node:20-slim

# Chromium + bibliotecas necessárias para o Puppeteer rodar em modo headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Usa o Chromium do sistema em vez de baixar um novo binário
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data /app/.wwebjs_auth

VOLUME ["/app/.wwebjs_auth", "/app/data"]

CMD ["node", "bot/index.js"]
