const config = require('./config');
const { PLANOS, serviceNamesForPlan } = require('./catalog');
const { classifyLead, saveLead, notifyAdmins } = require('./leadStore');

const STEPS = {
    MENU: 'MENU',
    ASK_NAME: 'ASK_NAME',
    ASK_COMPANY: 'ASK_COMPANY',
    ASK_CITY: 'ASK_CITY',
    ASK_PLAN: 'ASK_PLAN',
    ASK_SERVICE: 'ASK_SERVICE',
    ASK_OBJECTIVE: 'ASK_OBJECTIVE',
    ASK_TIME: 'ASK_TIME',
    ASK_MESSAGE: 'ASK_MESSAGE',
    CONFIRM: 'CONFIRM',
    HUMAN: 'HUMAN',
};

// Sessões em memória: chatId -> { step, data, lastActivity }
const sessions = new Map();

function getSession(chatId) {
    let s = sessions.get(chatId);
    const now = Date.now();
    if (!s) {
        s = { step: STEPS.MENU, data: {}, lastActivity: now, isNew: true };
        sessions.set(chatId, s);
        return s;
    }
    if (now - s.lastActivity > config.sessionTimeoutMs) {
        s.step = STEPS.MENU;
        s.data = {};
        s.isNew = true;
    } else {
        s.isNew = false;
    }
    s.lastActivity = now;
    return s;
}

function resetSession(chatId) {
    sessions.set(chatId, { step: STEPS.MENU, data: {}, lastActivity: Date.now(), isNew: true });
}

// ---------------------------------------------------------------
// Textos
// ---------------------------------------------------------------
function greetingText() {
    return (
        `Olá! 👋 Seja bem-vindo(a) à *${config.companyName}*!\n\n` +
        `Eu sou o assistente virtual e vou te ajudar a entender qual serviço faz mais sentido ` +
        `para o seu negócio. Leva menos de 2 minutos. 😊\n\n${menuText()}`
    );
}

function menuText() {
    return (
        `Como posso te ajudar hoje?\n\n` +
        `1️⃣ Quero um orçamento / falar sobre planos\n` +
        `2️⃣ Conhecer o catálogo de serviços\n` +
        `3️⃣ Falar com um atendente humano\n\n` +
        `Digite o número da opção desejada.`
    );
}

function plansOverviewText() {
    return (
        `📋 *Nossos planos*\n\n` +
        `🔹 *Plano Básico* — o essencial para começar: presença digital, redes sociais e organização comercial.\n` +
        `🔸 *Plano Essencial* — inclui SEO, mídias sociais e apoio comercial mais completo.\n` +
        `⭐ *Plano Avançado* — pacote completo com todos os serviços e prioridade no atendimento.\n\n` +
        `Digite *1* quando quiser montar seu orçamento, ou *menu* para voltar.`
    );
}

function askPlanText() {
    const lines = PLANOS.map((p, i) => `${i + 1}️⃣ ${p}`).join('\n');
    return (
        `Ótimo! Qual plano mais te interessa?\n\n${lines}\n${PLANOS.length + 1}️⃣ Ainda não sei, quero uma indicação\n\n` +
        `Digite o número correspondente.`
    );
}

function askServiceText(plano) {
    const services = serviceNamesForPlan(plano);
    const lines = services.map((s, i) => `${i + 1}️⃣ ${s}`).join('\n');
    return (
        `Perfeito. Dentro desse plano, qual serviço chamou mais sua atenção?\n\n${lines}\n\n` +
        `Digite o número, ou descreva com suas palavras se preferir.`
    );
}

function askTimeText() {
    return (
        `Qual o melhor horário para entrarmos em contato?\n\n` +
        `1️⃣ Manhã\n2️⃣ Tarde\n3️⃣ Noite\n4️⃣ Qualquer horário\n\n` +
        `Nosso horário de atendimento: ${config.workingHours}.`
    );
}

function summaryText(data) {
    const { temperatura, prioridade } = classifyLead(data);
    return (
        `📄 *Resumo do seu atendimento*\n\n` +
        `👤 Nome: ${data.nome || '-'}\n` +
        `🏢 Empresa: ${data.empresa || '-'}\n` +
        `📍 Cidade: ${data.cidade || '-'}\n` +
        `💼 Plano de interesse: ${data.plano || '-'}\n` +
        `🎯 Serviço: ${data.servicoInteresse || '-'}\n` +
        `📌 Objetivo: ${data.objetivoPrincipal || '-'}\n` +
        `🕐 Melhor horário: ${data.melhorHorario || '-'}\n` +
        `📝 Mensagem: ${data.mensagem || '-'}\n` +
        `🌡️ Classificação: ${temperatura} · prioridade ${prioridade}\n\n` +
        `Está tudo certo? Responda *sim* para confirmar o envio ou *corrigir* para preencher novamente.`
    );
}

function thankYouText(data) {
    return (
        `Prontinho, ${data.nome ? data.nome.split(' ')[0] : ''}! ✅\n\n` +
        `Recebemos suas informações e nossa equipe vai entrar em contato no período que você escolheu ` +
        `(${data.melhorHorario || 'em breve'}).\n\n` +
        `Se quiser falar com um atendente agora, digite *atendente*. Para começar de novo, digite *menu*.`
    );
}

// ---------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------
// Utilitário de envio ajustado para usar a mensagem de origem
async function send(msg, text) {
    try {
        const chat = await msg.getChat();
        await chat.sendStateTyping();
        await new Promise((r) => setTimeout(r, 600));
        
        // msg.reply envia diretamente de volta para quem mandou a mensagem,
        // tratando IDs @c.us e @lid automaticamente!
        await msg.reply(text);
        await chat.clearState();
    } catch (e) {
        console.error('Erro ao enviar mensagem:', e.message);
    }
}

function isSkip(text) {
    return ['pular', 'skip', '-'].includes(text.trim().toLowerCase());
}

function parseNumberChoice(text, max) {
    const n = parseInt(text.trim(), 10);
    if (Number.isInteger(n) && n >= 1 && n <= max) return n;
    return null;
}

// ---------------------------------------------------------------
// Handler principal — chamado pelo bot/index.js a cada mensagem recebida
// ---------------------------------------------------------------
async function handleMessage(client, msg) {
    const chat = await msg.getChat();
    if (chat.isGroup) return;
    if (msg.from === 'status@broadcast') return;

    const chatId = msg.from;
    const text = (msg.body || '').trim();
    const lower = text.toLowerCase();
    const session = getSession(chatId);

    // Comandos globais
    if (['menu', 'reiniciar', 'recomeçar', 'recomecar'].includes(lower)) {
        resetSession(chatId);
        return send(msg, menuText());
    }
    if (lower === 'atendente') {
        session.step = STEPS.HUMAN;
        await send(
            msg,
            'Combinado! Um atendente humano vai assumir esta conversa em breve. ' +
                `Nosso horário de atendimento é ${config.workingHours}.`
        );
        const lead = saveLead(chatId, { ...session.data, mensagem: session.data.mensagem || 'Solicitou atendente humano' });
        return notifyAdmins(client, lead);
    }

    // Primeira mensagem do usuário (Boas-vindas)
    if (session.isNew) {
        session.step = STEPS.MENU;
        return send(msg, greetingText());
    }

    switch (session.step) {
        case STEPS.MENU: {
            if (text === '1') {
                session.step = STEPS.ASK_NAME;
                return send(msg, 'Legal! Para começar, qual é o seu nome?');
            }
            if (text === '2') {
                return send(msg, plansOverviewText());
            }
            if (text === '3') {
                session.step = STEPS.HUMAN;
                await send(msg, `Ok! Um atendente vai te responder por aqui em breve (${config.workingHours}).`);
                const lead = saveLead(chatId, { mensagem: 'Solicitou atendente humano pelo menu' });
                return notifyAdmins(client, lead);
            }
            return send(msg, `Não entendi. 🙂\n\n${menuText()}`);
        }

        case STEPS.ASK_NAME: {
            if (!text) return send(msg, 'Pode me dizer seu nome, por favor?');
            session.data.nome = text;
            session.step = STEPS.ASK_COMPANY;
            return send(msg, `Prazer, ${text.split(' ')[0]}! Qual é o nome da sua empresa? (ou digite "pular")`);
        }

        case STEPS.ASK_COMPANY: {
            session.data.empresa = isSkip(text) ? '' : text;
            session.step = STEPS.ASK_CITY;
            return send(msg, 'Em qual cidade você está?');
        }

        case STEPS.ASK_CITY: {
            session.data.cidade = text;
            session.step = STEPS.ASK_PLAN;
            return send(msg, askPlanText());
        }

        case STEPS.ASK_PLAN: {
            const choice = parseNumberChoice(text, PLANOS.length + 1);
            if (!choice) return send(msg, `Não entendi a opção. ${askPlanText()}`);
            session.data.plano = choice <= PLANOS.length ? PLANOS[choice - 1] : '';
            session.step = STEPS.ASK_SERVICE;
            return send(msg, askServiceText(session.data.plano));
        }

        case STEPS.ASK_SERVICE: {
            const services = serviceNamesForPlan(session.data.plano);
            const choice = parseNumberChoice(text, services.length);
            session.data.servicoInteresse = choice ? services[choice - 1] : text;
            session.step = STEPS.ASK_OBJECTIVE;
            return send(
                msg,
                'Qual é o seu principal objetivo com esse serviço? (ex: gerar mais vendas, atrair clientes, organizar o comercial...)'
            );
        }

        case STEPS.ASK_OBJECTIVE: {
            session.data.objetivoPrincipal = text;
            session.step = STEPS.ASK_TIME;
            return send(msg, askTimeText());
        }

        case STEPS.ASK_TIME: {
            const options = { 1: 'Manhã', 2: 'Tarde', 3: 'Noite', 4: 'Qualquer horário' };
            session.data.melhorHorario = options[text.trim()] || text;
            session.step = STEPS.ASK_MESSAGE;
            return send(msg, 'Por fim, quer deixar alguma mensagem ou detalhe adicional? (ou digite "pular")');
        }

        case STEPS.ASK_MESSAGE: {
            session.data.mensagem = isSkip(text) ? '' : text;
            session.step = STEPS.CONFIRM;
            return send(msg, summaryText(session.data));
        }

        case STEPS.CONFIRM: {
            if (lower === 'sim') {
                const lead = saveLead(chatId, session.data);
                await send(msg, thankYouText(session.data));
                await notifyAdmins(client, lead);
                resetSession(chatId);
                return;
            }
            if (lower === 'corrigir') {
                session.step = STEPS.ASK_NAME;
                session.data = {};
                return send(msg, 'Sem problemas, vamos refazer. Qual é o seu nome?');
            }
            return send(msg, `Responda *sim* para confirmar ou *corrigir* para refazer.\n\n${summaryText(session.data)}`);
        }

        case STEPS.HUMAN: {
            return;
        }

        default: {
            resetSession(chatId);
            return send(msg, greetingText());
        }
    }
}

module.exports = { handleMessage, STEPS, sessions };
