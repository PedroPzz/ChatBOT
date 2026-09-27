const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, Location, Poll, List, Buttons, LocalAuth } = require('./index');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.initialize();

client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

client.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
});

client.on('code', (code) => {
    console.log('Pairing code:', code);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', async () => {
    console.log('READY');
    const debugWWebVersion = await client.getWWebVersion();
    console.log(`WWebVersion = ${debugWWebVersion}`);

    client.pupPage.on('pageerror', function (err) {
        console.log('Page error: ' + err.toString());
    });
    client.pupPage.on('error', function (err) {
        console.log('Page error: ' + err.toString());
    });
});

client.on('message', async (msg) => {
    console.log(`[${msg.from}] disse: ${msg.body}`);

    try {
        if (msg.body === '!ping reply') {
            await msg.reply('pong');
        } else if (msg.body === '!ping') {
            await client.sendMessage(msg.from, 'pong');
        } else if (msg.body.startsWith('!sendto ')) {
            let number = msg.body.split(' ')[1];
            let messageIndex = msg.body.indexOf(number) + number.length;
            let message = msg.body.slice(messageIndex).trim();
            number = number.includes('@c.us') || number.includes('@lid') ? number : `${number}@c.us`;
            let chat = await msg.getChat();
            await chat.sendSeen();
            await client.sendMessage(number, message);
        } else if (msg.body.startsWith('!subject ')) {
            let chat = await msg.getChat();
            if (chat.isGroup) {
                let newSubject = msg.body.slice(9);
                await chat.setSubject(newSubject);
            } else {
                await msg.reply('This command can only be used in a group!');
            }
        } else if (msg.body.startsWith('!echo ')) {
            await msg.reply(msg.body.slice(6));
        } else if (msg.body.startsWith('!preview ')) {
            const text = msg.body.slice(9);
            await msg.reply(text, null, { linkPreview: true });
        } else if (msg.body.startsWith('!desc ')) {
            let chat = await msg.getChat();
            if (chat.isGroup) {
                let newDescription = msg.body.slice(6);
                await chat.setDescription(newDescription);
            } else {
                await msg.reply('This command can only be used in a group!');
            }
        } else if (msg.body === '!leave') {
            let chat = await msg.getChat();
            if (chat.isGroup) {
                await chat.leave();
            } else {
                await msg.reply('This command can only be used in a group!');
            }
        } else if (msg.body.startsWith('!join ')) {
            const inviteCode = msg.body.split(' ')[1];
            try {
                await client.acceptInvite(inviteCode);
                await msg.reply('Joined the group!');
            } catch (e) {
                console.error(e);
                await msg.reply('That invite code seems to be invalid.');
            }
        } else if (msg.body.startsWith('!addmembers')) {
            const group = await msg.getChat();
            const result = await group.addParticipants([
                'number1@c.us',
                'number2@c.us',
                'number3@c.us'
            ]);
            console.log(result);
        } else if (msg.body === '!creategroup') {
            const partitipantsToAdd = [
                'number1@c.us',
                'number2@c.us',
                'number3@c.us'
            ];
            const result = await client.createGroup('Group Title', partitipantsToAdd);
            console.log(result);
        } else if (msg.body === '!groupinfo') {
            let chat = await msg.getChat();
            if (chat.isGroup) {
                await msg.reply(`
*Group Details*
Name: ${chat.name}
Description: ${chat.description}
Created At: ${chat.createdAt.toString()}
Created By: ${chat.owner.user}
Participant count: ${chat.participants.length}
                `);
            } else {
                await msg.reply('This command can only be used in a group!');
            }
        } else if (msg.body === '!chats') {
            const chats = await client.getChats();
            await client.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
        } else if (msg.body === '!info') {
            let info = client.info;
            await client.sendMessage(
                msg.from,
                `
*Connection info*
User name: ${info.pushname}
My number: ${info.wid.user}
Platform: ${info.platform}
                `
            );
        } else if (msg.body === '!streamdownload' && msg.hasMedia) {
            const result = await msg.downloadMediaStream();
            if (result) {
                const filePath = `./${result.filename || 'download'}`;
                const writeStream = fs.createWriteStream(filePath);
                result.stream.pipe(writeStream);
                writeStream.on('finish', async () => {
                    await msg.reply(
                        `Media saved to ${filePath} (${result.mimetype}, ${result.filesize} bytes)`
                    );
                });
            }
        } else if (msg.body === '!mediainfo' && msg.hasMedia) {
            const attachmentData = await msg.downloadMedia();
            await msg.reply(`
*Media info*
MimeType: ${attachmentData.mimetype}
Filename: ${attachmentData.filename}
Data (length): ${attachmentData.data.length}
            `);
        } else if (msg.body === '!quoteinfo' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            await quotedMsg.reply(`
ID: ${quotedMsg.id._serialized}
Type: ${quotedMsg.type}
Author: ${quotedMsg.author || quotedMsg.from}
Timestamp: ${quotedMsg.timestamp}
Has Media? ${quotedMsg.hasMedia}
            `);
        } else if (msg.body === '!resendmedia' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                const attachmentData = await quotedMsg.downloadMedia();
                await client.sendMessage(msg.from, attachmentData, {
                    caption: "Here's your requested media."
                });
            }
            if (quotedMsg.hasMedia && quotedMsg.type === 'audio') {
                const audio = await quotedMsg.downloadMedia();
                await client.sendMessage(msg.from, audio, {
                    sendAudioAsVoice: true
                });
            }
        } else if (msg.body === '!isviewonce' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                const media = await quotedMsg.downloadMedia();
                await client.sendMessage(msg.from, media, { isViewOnce: true });
            }
        } else if (msg.body === '!location') {
            await msg.reply(new Location(37.422, -122.084));
            await msg.reply(new Location(37.422, -122.084, { name: 'Googleplex' }));
            await msg.reply(
                new Location(37.422, -122.084, {
                    address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA'
                })
            );
            await msg.reply(
                new Location(37.422, -122.084, {
                    name: 'Googleplex',
                    address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
                    url: 'https://google.com'
                })
            );
        } else if (msg.location) {
            await msg.reply(msg.location);
        } else if (msg.body.startsWith('!status ')) {
            const newStatus = msg.body.split(' ')[1];
            await client.setStatus(newStatus);
            await msg.reply(`Status was updated to *${newStatus}*`);
        } else if (msg.body === '!mentionUsers') {
            const chat = await msg.getChat();
            const userNumber = 'XXXXXXXXXX';
            await chat.sendMessage(`Hi @${userNumber}`, {
                mentions: userNumber + '@c.us'
            });
            await chat.sendMessage(`Hi @${userNumber}, @${userNumber}`, {
                mentions: [userNumber + '@c.us', userNumber + '@c.us']
            });
        } else if (msg.body === '!mentionGroups') {
            const chat = await msg.getChat();
            const groupId = 'YYYYYYYYYY@g.us';
            await chat.sendMessage(`Check the last message here: @${groupId}`, {
                groupMentions: { subject: 'GroupSubject', id: groupId }
            });
            await chat.sendMessage(
                `Check the last message in these groups: @${groupId}, @${groupId}`,
                {
                    groupMentions: [
                        { subject: 'FirstGroup', id: groupId },
                        { subject: 'SecondGroup', id: groupId }
                    ]
                }
            );
        } else if (msg.body === '!getGroupMentions') {
            const groupId = 'ZZZZZZZZZZ@g.us';
            const sentMsg = await client.sendMessage(
                msg.from,
                `Check the last message here: @${groupId}`,
                {
                    groupMentions: { subject: 'GroupSubject', id: groupId }
                }
            );
            const groupMentions = await sentMsg.getGroupMentions();
            console.log(groupMentions);
        } else if (msg.body === '!delete') {
            if (msg.hasQuotedMsg) {
                const quotedMsg = await msg.getQuotedMessage();
                if (quotedMsg.fromMe) {
                    await quotedMsg.delete(true);
                } else {
                    await msg.reply('I can only delete my own messages');
                }
            }
        } else if (msg.body === '!pin') {
            const chat = await msg.getChat();
            await chat.pin();
        } else if (msg.body === '!archive') {
            const chat = await msg.getChat();
            await chat.archive();
        } else if (msg.body === '!mute') {
            const chat = await msg.getChat();
            const unmuteDate = new Date();
            unmuteDate.setSeconds(unmuteDate.getSeconds() + 20);
            await chat.mute(unmuteDate);
        } else if (msg.body === '!typing') {
            const chat = await msg.getChat();
            await chat.sendStateTyping();
        } else if (msg.body === '!recording') {
            const chat = await msg.getChat();
            await chat.sendStateRecording();
        } else if (msg.body === '!clearstate') {
            const chat = await msg.getChat();
            await chat.clearState();
        } else if (msg.body === '!jumpto') {
            if (msg.hasQuotedMsg) {
                const quotedMsg = await msg.getQuotedMessage();
                client.interface.openChatWindowAt(quotedMsg.id._serialized);
            }
        } else if (msg.body === '!buttons') {
            let button = new Buttons(
                'Button body',
                [{ body: 'bt1' }, { body: 'bt2' }, { body: 'bt3' }],
                'title',
                'footer'
            );
            await client.sendMessage(msg.from, button);
        } else if (msg.body === '!list') {
            let sections = [
                {
                    title: 'sectionTitle',
                    rows: [
                        { title: 'ListItem1', description: 'desc' },
                        { title: 'ListItem2' }
                    ]
                }
            ];
            let list = new List(
                'List body',
                'btnText',
                sections,
                'Title',
                'footer'
            );
            await client.sendMessage(msg.from, list);
        } else if (msg.body === '!reaction') {
            await msg.react('👍');
        } else if (msg.body === '!sendpoll') {
            await msg.reply(new Poll('Winter or Summer?', ['Winter', 'Summer']));
            await msg.reply(
                new Poll('Cats or Dogs?', ['Cats', 'Dogs'], {
                    allowMultipleAnswers: true
                })
            );
            await msg.reply(
                new Poll('Cats or Dogs?', ['Cats', 'Dogs'], {
                    messageSecret: [
                        1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
                    ]
                })
            );
        } else if (msg.body.startsWith('!vote')) {
            if (msg.hasQuotedMsg) {
                const quotedMsg = await msg.getQuotedMessage();
                if (quotedMsg.type === 'poll_creation') {
                    await quotedMsg.vote(msg.body.replace('!vote', '').trim());
                } else {
                    await msg.reply('Can only be used on poll messages');
                }
            }
        } else if (msg.body.startsWith('!edit')) {
            if (msg.hasQuotedMsg) {
                const quotedMsg = await msg.getQuotedMessage();
                if (quotedMsg.fromMe) {
                    await quotedMsg.edit(msg.body.replace('!edit', '').trim());
                } else {
                    await msg.reply('I can only edit my own messages');
                }
            }
        } else if (msg.body === '!updatelabels') {
            const chat = await msg.getChat();
            await chat.changeLabels([0, 1]);
        } else if (msg.body === '!addlabels') {
            const chat = await msg.getChat();
            let labels = (await chat.getLabels()).map((l) => l.id);
            labels.push('0', '1');
            await chat.changeLabels(labels);
        } else if (msg.body === '!removelabels') {
            const chat = await msg.getChat();
            await chat.changeLabels([]);
        } else if (msg.body === '!approverequest') {
            await client.approveGroupMembershipRequests(msg.from, {
                requesterIds: 'number@c.us'
            });
            const group = await msg.getChat();
            await group.approveGroupMembershipRequests({
                requesterIds: 'number@c.us'
            });
        } else if (msg.body === '!pinmsg') {
            const result = await msg.pin(60);
            console.log(result);
        } else if (msg.body === '!howManyConnections') {
            let deviceCount = await client.getContactDeviceCount(msg.from);
            await msg.reply(`You have *${deviceCount}* devices connected`);
        } else if (msg.body === '!syncHistory') {
            const isSynced = await client.syncHistory(msg.from);
            await msg.reply(
                isSynced
                    ? 'Historical chat is syncing..'
                    : 'There is no historical chat to sync.'
            );
        } else if (msg.body === '!statuses') {
            const statuses = await client.getBroadcasts();
            console.log(statuses);
            const chat = await statuses[0]?.getChat();
            console.log(chat);
        } else if (msg.body === '!sendMediaHD' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                const media = await quotedMsg.downloadMedia();
                await client.sendMessage(msg.from, media, { sendMediaAsHd: true });
            }
        } else if (msg.body === '!parseVCard') {
            const vCard =
                'BEGIN:VCARD\n' +
                'VERSION:3.0\n' +
                'FN:John Doe\n' +
                'ORG:Microsoft;\n' +
                'EMAIL;type=INTERNET:john.doe@gmail.com\n' +
                'URL:www.johndoe.com\n' +
                'TEL;type=CELL;type=VOICE;waid=18006427676:+1 (800) 642 7676\n' +
                'END:VCARD';
            const userId = msg.from;
            await client.sendMessage(userId, vCard);
        } else if (msg.body === '!changeSync') {
            const backgroundSync = await client.setBackgroundSync(true);
            console.log(backgroundSync);
        } else if (msg.body === '!postStatus') {
            await client.sendMessage('status@broadcast', 'Hello there!');
        }
    } catch (err) {
        console.error('Erro ao processar mensagem:', err);
    }
});

client.on('message_create', async (msg) => {
    if (msg.fromMe && msg.body.startsWith('!unpin')) {
        const pinnedMsg = await msg.getQuotedMessage();
        if (pinnedMsg) {
            const result = await pinnedMsg.unpin();
            console.log(result);
        }
    }
});

client.on('message_ciphertext', (msg) => {
    msg.body = 'Waiting for this message. Check your phone.';
});

client.on('message_revoke_everyone', async (after, before) => {
    console.log(after);
    if (before) {
        console.log(before);
    }
});

client.on('message_revoke_me', async (msg) => {
    console.log(msg.body);
});

client.on('message_ack', (msg, ack) => {
    if (ack === 3) {
        // Mensagem lida
    }
});

client.on('group_join', (notification) => {
    console.log('join', notification);
    notification.reply('User joined.');
});

client.on('group_leave', (notification) => {
    console.log('leave', notification);
    notification.reply('User left.');
});

client.on('group_update', (notification) => {
    console.log('update', notification);
});

client.on('change_state', (state) => {
    console.log('CHANGE STATE', state);
});

let rejectCalls = true;

client.on('call', async (call) => {
    console.log('Call received, rejecting.', call);
    if (rejectCalls) await call.reject();
    await client.sendMessage(
        call.from,
        `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`
    );
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

client.on('contact_changed', async (message, oldId, newId, isContact) => {
    const eventTime = new Date(message.timestamp * 1000).toLocaleString();
    console.log(
        `The contact ${oldId.slice(0, -5)} changed their phone number at ${eventTime}.\n` +
        `Their new phone number is ${newId.slice(0, -5)}.\n`
    );
});

client.on('group_admin_changed', (notification) => {
    if (notification.type === 'promote') {
        console.log(`You were promoted by ${notification.author}`);
    } else if (notification.type === 'demote') {
        console.log(`You were demoted by ${notification.author}`);
    }
});

client.on('group_membership_request', async (notification) => {
    console.log(notification);
    await client.approveGroupMembershipRequests(
        notification.chatId,
        { requesterIds: notification.author }
    );
});

client.on('message_reaction', async (reaction) => {
    console.log('REACTION RECEIVED', reaction);
});

client.on('vote_update', (vote) => {
    console.log(vote);
});
