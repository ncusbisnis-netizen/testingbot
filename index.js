// ========== WHATSAPP BOT SEDERHANA ==========
// Tanpa API Key, hanya fitur dasar
// Session ID tersimpan otomatis

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== KONFIGURASI DARI ENV ==========
const PREFIX = process.env.PREFIX || '!';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '628123456789';
const SESSION_NAME = process.env.SESSION_NAME || 'whatsapp-bot-session';
const BOT_NAME = process.env.BOT_NAME || 'SimpleBot';

// ========== INISIALISASI CLIENT ==========
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: SESSION_NAME
    }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--headless=new'
        ]
    }
});

// ========== CEK SESSION ==========
const sessionPath = `./.wwebjs_auth/${SESSION_NAME}`;
if (fs.existsSync(sessionPath)) {
    console.log('✅ Session ID ditemukan!');
} else {
    console.log('📱 Session baru, scan QR sekali saja');
}

// ========== EVENT QR ==========
client.on('qr', (qr) => {
    console.log('\n📱 SCAN QR INI:');
    console.log('='.repeat(40));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(40));
});

// ========== EVENT READY ==========
client.on('ready', () => {
    console.log('\n✅ BOT SIAP!');
    console.log(`📱 Nomor: ${client.info.wid.user}`);
    console.log(`🔐 Session: ${SESSION_NAME}`);
    console.log(`⚡ Prefix: ${PREFIX}`);
    console.log(`👑 Owner: ${OWNER_NUMBER}`);
});

// ========== EVENT DISCONNECTED ==========
client.on('disconnected', (reason) => {
    console.log('❌ Putus:', reason);
    setTimeout(() => client.initialize(), 10000);
});

// ========== FORMAT NOMOR ==========
function formatNumber(number) {
    return number.split('@')[0];
}

// ========== CEK OWNER ==========
function isOwner(number) {
    return formatNumber(number) === OWNER_NUMBER;
}

// ========== HANDLER PESAN ==========
client.on('message', async (msg) => {
    try {
        // Abaikan status
        if (msg.from === 'status@broadcast') return;
        
        const chat = await msg.getChat();
        const sender = msg.from;
        const senderNumber = formatNumber(sender);
        const message = msg.body;
        const isGroup = chat.isGroup;
        
        // Log pesan
        if (isGroup) {
            console.log(`👥 [GRUP] ${chat.name}: ${message}`);
        } else {
            console.log(`👤 ${senderNumber}: ${message}`);
        }
        
        // Cek prefix
        if (!message.startsWith(PREFIX)) return;
        
        const args = message.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        // ========== COMMAND UMUM ==========
        
        // !menu
        if (command === 'menu') {
            let menu = `*${BOT_NAME}*\n\n`;
            menu += `┌ *!menu* - Menu ini\n`;
            menu += `├ *!ping* - Cek bot\n`;
            menu += `├ *!info* - Info bot\n`;
            
            if (isGroup) {
                menu += `├ *!idgrup* - ID grup ini\n`;
            }
            
            menu += `├ *!say* [teks] - Bot ngomong\n`;
            menu += `└ *!owner* - Kontak owner\n\n`;
            menu += `Prefix: ${PREFIX}`;
            
            await msg.reply(menu);
        }
        
        // !ping
        else if (command === 'ping') {
            await msg.reply('🏓 Pong!');
        }
        
        // !info
        else if (command === 'info') {
            const info = `*INFO BOT*\n\n` +
                `Nama: ${BOT_NAME}\n` +
                `Prefix: ${PREFIX}\n` +
                `Owner: ${OWNER_NUMBER}\n` +
                `Session: ${SESSION_NAME}\n` +
                `Status: 🟢 Online`;
            
            await msg.reply(info);
        }
        
        // !say
        else if (command === 'say') {
            if (args.length === 0) {
                await msg.reply(`Contoh: ${PREFIX}say Halo`);
                return;
            }
            await msg.reply(args.join(' '));
        }
        
        // !owner
        else if (command === 'owner') {
            await msg.reply(`👑 Owner: @${OWNER_NUMBER}`);
        }
        
        // ========== COMMAND GRUP ==========
        
        // !idgrup (khusus grup)
        else if (command === 'idgrup' || command === 'idgroup') {
            if (!isGroup) {
                await msg.reply('❌ Perintah ini hanya untuk grup!');
                return;
            }
            
            const response = `📊 *ID GRUP*\n\n` +
                `Nama: ${chat.name}\n` +
                `ID: \`${chat.id._serialized}\`\n` +
                `Member: ${chat.participants.length}`;
            
            await msg.reply(response);
        }
        
        // !infogrup (khusus grup)
        else if (command === 'infogrup' || command === 'infogroup') {
            if (!isGroup) {
                await msg.reply('❌ Perintah ini hanya untuk grup!');
                return;
            }
            
            const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
            
            const response = `ℹ️ *INFO GRUP*\n\n` +
                `Nama: ${chat.name}\n` +
                `ID: \`${chat.id._serialized}\`\n` +
                `Member: ${chat.participants.length}\n` +
                `Admin: ${admins.length}\n` +
                `Dibuat: ${chat.createdAt ? new Date(chat.createdAt).toLocaleDateString() : '-'}`;
            
            await msg.reply(response);
        }
        
        // ========== COMMAND OWNER ==========
        
        // !restart (khusus owner)
        else if (command === 'restart') {
            if (!isOwner(sender)) {
                await msg.reply('❌ Hanya owner!');
                return;
            }
            
            await msg.reply('🔄 Restart bot...');
            console.log('🔄 Restart oleh owner');
            process.exit(0);
        }
        
        // !session (khusus owner)
        else if (command === 'session') {
            if (!isOwner(sender)) {
                await msg.reply('❌ Hanya owner!');
                return;
            }
            
            const sessionExist = fs.existsSync(sessionPath);
            const files = sessionExist ? fs.readdirSync(sessionPath) : [];
            
            const response = `🔐 *SESSION INFO*\n\n` +
                `Nama: ${SESSION_NAME}\n` +
                `Lokasi: ${sessionPath}\n` +
                `Status: ${sessionExist ? '✅ Ada' : '❌ Tidak ada'}\n` +
                `File: ${files.length} file`;
            
            await msg.reply(response);
        }
        
    } catch (error) {
        console.log('Error:', error.message);
        await msg.reply('❌ Error, coba lagi');
    }
});

// ========== WEB SERVER ==========
app.get('/', (req, res) => {
    res.send(`
        <h1>${BOT_NAME}</h1>
        <p>Status: 🟢 Online</p>
        <p>Nomor: ${client.info ? client.info.wid.user : 'Belum login'}</p>
        <p>Session: ${fs.existsSync(sessionPath) ? '✅' : '❌'}</p>
        <p>Prefix: ${PREFIX}</p>
    `);
});

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        bot: client.info ? 'connected' : 'disconnected',
        number: client.info ? client.info.wid.user : null,
        session: fs.existsSync(sessionPath),
        prefix: PREFIX,
        owner: OWNER_NUMBER
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Web: http://localhost:${PORT}`);
});

// ========== START ==========
console.log('🚀 Starting bot...');
client.initialize();
