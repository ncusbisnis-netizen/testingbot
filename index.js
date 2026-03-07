const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== KONFIGURASI ==========
const PREFIX = '!';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '628xxxxxx'; // Ganti nanti di Heroku

// ========== INIT BOT ==========
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'heroku-session' // Session ID
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new']
    }
});

// ========== QR CODE ==========
client.on('qr', (qr) => {
    console.log('\n📱 SCAN QR INI:');
    qrcode.generate(qr, { small: true });
});

// ========== BOT READY ==========
client.on('ready', () => {
    console.log('✅ BOT SIAP!');
    console.log(`📱 Nomor: ${client.info.wid.user}`);
});

// ========== PESAN MASUK ==========
client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast') return;
    
    const chat = await msg.getChat();
    const message = msg.body;
    const isGroup = chat.isGroup;
    
    if (!message.startsWith(PREFIX)) return;
    
    const args = message.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // ===== COMMAND UMUM =====
    if (command === 'menu') {
        let menu = `*MENU BOT*\n\n`;
        menu += `!ping - Cek bot\n`;
        menu += `!info - Info bot\n`;
        menu += `!owner - Kontak owner\n`;
        
        if (isGroup) {
            menu += `!idgrup - Lihat ID grup\n`;
        }
        
        await msg.reply(menu);
    }
    
    else if (command === 'ping') {
        await msg.reply('Pong!');
    }
    
    else if (command === 'info') {
        await msg.reply(`Bot aktif di nomor: ${client.info.wid.user}`);
    }
    
    else if (command === 'owner') {
        await msg.reply(`Owner: ${OWNER_NUMBER}`);
    }
    
    else if (command === 'idgrup' && isGroup) {
        await msg.reply(`ID Grup: ${chat.id._serialized}`);
    }
});

// ========== WEB ==========
app.get('/', (req, res) => {
    res.send('Bot WhatsApp Jalan!');
});

app.listen(PORT, () => {
    console.log(`Server web di port ${PORT}`);
});

client.initialize();
