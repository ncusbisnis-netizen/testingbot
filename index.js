import makeWASocket, { useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import P from 'pino';
import fs from 'fs';

const { state, saveState } = useSingleFileAuthState('./session.json');

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            if(lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                startBot(); // reconnect
            } else {
                console.log('Logout detected, harus scan QR lagi');
            }
        } else if(connection === 'open') {
            console.log('BOT CONNECTED');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if(type !== 'notify') return;
        const msg = messages[0];
        if(!msg.message) return;
        if(msg.key && msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        console.log('EVENT PESAN MASUK', from, body);

        const sender = msg.key.participant || from;
        const BOT_ADMINS = ['628xxxxxxxxx@s.whatsapp.net'];

        if(body.startsWith('!idgrup')) {
            if(!BOT_ADMINS.includes(sender)) return;

            let reply = '';
            const parts = body.split(' ');
            if(parts[1]) {
                reply = `ID grup dari link ${parts[1]}: ${parts[1]}`;
            } else {
                reply = `ID grup ini: ${from}`;
            }

            await sock.sendMessage(from, { text: reply });
        }
    });
}

startBot().catch(err => console.log(err));
