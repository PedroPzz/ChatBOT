const http = require('http');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('../index');
const config = require('./config');
const { handleMessage } = require('./conversation');

let isReady = false;
let reconnectTimer = null;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: config.sessionAuthPath }),
    puppeteer: {
        headless: true,
        executablePath: config.puppeteerExecutablePath,
        // Flags necessárias para rodar o Chromium em um servidor Linux (VPS/Docker),
        // onde normalmente não há sandbox de usuário disponível.
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
    },
});

client.on('qr', (qr) => {
    console.log('\nEscaneie o QR Code abaixo no WhatsApp (Aparelhos conectados):\n');
    qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
    console.log(`Carregando WhatsApp Web... ${percent}% - ${message}`);
});

client.on('authenticated', () => console.log('🔐 Autenticado com sucesso.'));

client.on('auth_failure', (msg) => {
    console.error('❌ Falha de autenticação:', msg);
});

client.on('ready', () => {
    isReady = true;
    console.log(`✅ Bot da ${config.companyName} conectado e pronto para atender!`);
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.error(`⚠️ Cliente desconectado (${reason}). Tentando reconectar em 10s...`);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        client.initialize().catch((err) => console.error('Erro ao reconectar:', err.message));
    }, 10000);
});

client.on('message', (msg) => {
    handleMessage(client, msg).catch((err) => console.error('Erro ao processar mensagem:', err));
});

// Encerramento gracioso (importante em VPS com pm2/systemd/docker)
async function shutdown(signal) {
    console.log(`\nRecebido ${signal}, encerrando o bot...`);
    clearTimeout(reconnectTimer);
    try {
        await client.destroy();
    } catch (e) {
        console.error('Erro ao encerrar o client:', e.message);
    }
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

// Healthcheck HTTP opcional — útil para monitoramento externo (UptimeRobot, etc.)
// Ative definindo HEALTH_PORT no .env
if (config.healthPort) {
    http
        .createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: isReady ? 'connected' : 'connecting' }));
            } else {
                res.writeHead(404);
                res.end();
            }
        })
        .listen(config.healthPort, () => {
            console.log(`Healthcheck disponível em http://localhost:${config.healthPort}/health`);
        });
}

console.log(`Iniciando bot da ${config.companyName}...`);
client.initialize();
