const { Client } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 ========== BOT WHATSAPP ==========');
console.log('📱 Menyiapkan bot...');

// PAKAI INI DULU - HAPUS SESSION ID
const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

// QR CODE
client.on('qr', (qr) => {
    console.log('\n📱 SCAN QR INI:');
    qrcode.generate(qr, { small: true });
    console.log('⏱️ Scan dalam 60 detik');
});

// READY
client.on('ready', () => {
    console.log('✅ ========== BOT SIAP! ==========');
    console.log('📱 Nomor Bot:', client.info.wid.user);
});

// AUTHENTICATED
client.on('authenticated', (session) => {
    console.log('✅ Session baru didapat!');
    console.log('📝 COPY INI BUAT DISIMPAN:');
    console.log(JSON.stringify(session));
});

// PESAN
client.on('message', async (msg) => {
    if (msg.body === '!ping') {
        await msg.reply('🏓 Pong!');
    }
});

app.get('/', (req, res) => {
    res.send('Bot WhatsApp Jalan!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Web server: http://localhost:' + PORT);
});

client.initialize();
