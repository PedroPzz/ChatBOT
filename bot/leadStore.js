const fs = require('fs');
const path = require('path');
const config = require('./config');

/** Classifica temperatura/prioridade do lead a partir das respostas coletadas. */
function classifyLead(data) {
    let temperatura = 'morno';
    let prioridade = 'media';

    const urgentWords = ['urgente', 'hoje', 'agora', 'rápido', 'rapido', 'preciso já', 'preciso ja'];
    const text = `${data.objetivoPrincipal || ''} ${data.mensagem || ''}`.toLowerCase();

    if (urgentWords.some((w) => text.includes(w))) {
        temperatura = 'quente';
        prioridade = 'alta';
    }
    if (data.plano === 'Plano Avançado') {
        prioridade = 'alta';
    }
    if (!data.mensagem && !data.objetivoPrincipal) {
        temperatura = 'frio';
    }

    return { temperatura, prioridade };
}

function ensureLeadsFile() {
    const dir = path.dirname(config.leadsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(config.leadsFile)) fs.writeFileSync(config.leadsFile, '[]', 'utf-8');
}

function readLeads() {
    ensureLeadsFile();
    try {
        return JSON.parse(fs.readFileSync(config.leadsFile, 'utf-8'));
    } catch (e) {
        console.error('Não foi possível ler leads.json, iniciando lista vazia:', e.message);
        return [];
    }
}

/** Salva um novo lead e devolve o objeto completo (com classificação e metadados). */
function saveLead(chatId, data) {
    const { temperatura, prioridade } = classifyLead(data);
    const lead = {
        id: `${Date.now()}`,
        criadoEm: new Date().toISOString(),
        telefone: chatId.replace('@c.us', ''),
        whatsapp: chatId.replace('@c.us', ''),
        origem: 'whatsapp_bot',
        etapa: 'novo_lead_whatsapp',
        temperatura,
        prioridade,
        ...data,
    };

    const leads = readLeads();
    leads.push(lead);
    ensureLeadsFile();
    fs.writeFileSync(config.leadsFile, JSON.stringify(leads, null, 2), 'utf-8');
    return lead;
}

/** Envia uma notificação de novo lead para os números de atendimento configurados. */
async function notifyAdmins(client, lead) {
    if (!config.adminNumbers.length) return;

    const text =
        `🔔 *Novo lead recebido!*\n\n` +
        `👤 ${lead.nome || '-'} · 🏢 ${lead.empresa || '-'}\n` +
        `📞 ${lead.telefone}\n` +
        `💼 ${lead.plano || '-'} · 🎯 ${lead.servicoInteresse || '-'}\n` +
        `🌡️ ${lead.temperatura} · prioridade ${lead.prioridade}\n` +
        `📝 ${lead.mensagem || '-'}`;

    for (const admin of config.adminNumbers) {
        try {
            await client.sendMessage(admin, text);
        } catch (e) {
            console.error(`Falha ao notificar ${admin}:`, e.message);
        }
    }
}

module.exports = { classifyLead, saveLead, notifyAdmins, readLeads };
