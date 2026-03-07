const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const PREFIX = '!';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '6283133199990';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n📱 SCAN QR:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ BOT SIAP!');
});

client.on('message', async (msg) => {
    if (msg.body === '!ping') {
        await msg.reply('pong');
    }
});

app.get('/', (req, res) => {
    res.send('Bot Jalan');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('Web: ' + PORT);
});

client.initialize();
