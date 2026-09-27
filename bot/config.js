require('dotenv').config();
const path = require('path');

function parseAdmins(raw) {
    if (!raw) return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((n) => (n.includes('@c.us') ? n : `${n}@c.us`));
}

module.exports = {
    companyName: process.env.COMPANY_NAME || 'Dos Marketing',
    adminNumbers: parseAdmins(process.env.ADMIN_NUMBERS),
    workingHours: process.env.WORKING_HOURS || 'Segunda a sexta, das 9h às 18h',
    leadsFile: process.env.LEADS_FILE
        ? path.resolve(process.env.LEADS_FILE)
        : path.join(__dirname, '..', 'data', 'leads.json'),
    sessionAuthPath: path.join(__dirname, '..', '.wwebjs_auth'),
    sessionTimeoutMs: (parseInt(process.env.SESSION_TIMEOUT_MIN, 10) || 15) * 60 * 1000,
    // Porta opcional para expor um healthcheck HTTP (/health). Deixe em branco para desativar.
    healthPort: process.env.HEALTH_PORT ? parseInt(process.env.HEALTH_PORT, 10) : null,
    // Caminho de um Chromium já instalado no sistema (recomendado em VPS). Deixe em branco
    // para usar o Chromium baixado automaticamente pelo Puppeteer.
    puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
};
