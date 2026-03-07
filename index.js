const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== KONFIGURASI ==========
const PREFIX = '!'; // Prefix command
const OWNER_NUMBER = process.env.OWNER_NUMBER || '628xxxxxx'; // Set di Heroku

// ========== INISIALISASI CLIENT ==========
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'heroku-session' // Session akan tersimpan
    }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--headless=new'
        ]
    }
});

// ========== QR CODE UNTUK SCAN ==========
client.on('qr', (qr) => {
    console.log('\n📱 SCAN QR CODE INI DENGAN WHATSAPP ANDA:');
    console.log('='.repeat(50));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(50));
    console.log('⏱️ QR Code akan expired dalam 60 detik');
});

// ========== BOT SIAP ==========
client.on('ready', () => {
    console.log('\n✅ BOT WHATSAPP SIAP DIGUNAKAN!');
    console.log(`📱 Nomor Bot: ${client.info.wid.user}`);
    console.log(`⚡ Prefix: ${PREFIX}`);
    console.log(`👑 Owner: ${OWNER_NUMBER}`);
});

// ========== AUTHENTICATED ==========
client.on('authenticated', () => {
    console.log('🔐 Session tersimpan!');
});

// ========== DISCONNECTED ==========
client.on('disconnected', (reason) => {
    console.log('❌ BOT TERPUTUS:', reason);
    console.log('🔄 Mencoba reconnect...');
    setTimeout(() => client.initialize(), 10000);
});

// ========== HANDLER PESAN ==========
client.on('message', async (msg) => {
    try {
        // Abaikan pesan dari group (opsional)
        if (msg.from.endsWith('@g.us')) return;
        
        // Abaikan status/story
        if (msg.from === 'status@broadcast') return;
        
        const sender = msg.from.split('@')[0];
        const message = msg.body;
        
        // Cek apakah pesan diawali prefix
        if (!message.startsWith(PREFIX)) return;
        
        // Parse command
        const args = message.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        console.log(`📨 Command: ${command} dari ${sender}`);
        
        // ========== COMMAND: !menu ==========
        if (command === 'menu' || command === 'help') {
            const menu = `╔══════════════════╗
║   *BOT MENU*    
╚══════════════════╝

┌ *!menu* - Tampilkan menu
├ *!ping* - Cek respon bot
├ *!info* - Info bot
├ *!time* - Jam sekarang
├ *!sticker* - Buat sticker
├ *!say* [teks] - Bot ngomong
└ *!owner* - Kontak owner

_Bot by @${OWNER_NUMBER}_`;
            
            await msg.reply(menu);
        }
        
        // ========== COMMAND: !ping ==========
        else if (command === 'ping') {
            const start = Date.now();
            await msg.reply('🏓 *Pong!*');
            const end = Date.now();
            await msg.reply(`⏱️ *${end - start}ms*`);
        }
        
        // ========== COMMAND: !info ==========
        else if (command === 'info') {
            const info = `*📱 INFORMASI BOT*
            
├ Nama: Simple WhatsApp Bot
├ Versi: 1.0.0
├ Prefix: ${PREFIX}
├ Platform: Heroku
├ Owner: ${OWNER_NUMBER}
└ Status: 🟢 Online`;
            
            await msg.reply(info);
        }
        
        // ========== COMMAND: !time ==========
        else if (command === 'time') {
            const now = new Date();
            const waktu = now.toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            await msg.reply(`🕐 *${waktu} WIB*`);
        }
        
        // ========== COMMAND: !say ==========
        else if (command === 'say') {
            if (args.length === 0) {
                await msg.reply('Contoh: !say Halo semua');
                return;
            }
            await msg.reply(args.join(' '));
        }
        
        // ========== COMMAND: !sticker ==========
        else if (command === 'sticker' || command === 'stiker') {
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                if (media) {
                    await msg.reply(media, undefined, {
                        sendMediaAsSticker: true,
                        stickerName: 'Bot Sticker',
                        stickerAuthor: `@${OWNER_NUMBER}`
                    });
                } else {
                    await msg.reply('❌ Gagal download media');
                }
            } else {
                await msg.reply('📸 Kirim gambar dengan caption !sticker');
            }
        }
        
        // ========== COMMAND: !owner ==========
        else if (command === 'owner') {
            await msg.reply(`👑 Owner: @${OWNER_NUMBER}`);
        }
        
    } catch (error) {
        console.log('Error:', error.message);
        await msg.reply('❌ Terjadi kesalahan');
    }
});

// ========== EXPRESS SERVER ==========
app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 WhatsApp Bot Active</h1>
        <p>Status: 🟢 Online</p>
        <p>Nomor: ${client.info ? client.info.wid.user : 'Belum login'}</p>
        <p>Scan QR di console Heroku untuk login</p>
    `);
});

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        bot: client.info ? 'connected' : 'disconnected',
        number: client.info ? client.info.wid.user : null
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Server web di port ${PORT}`);
});

// ========== START BOT ==========
console.log('🚀 Memulai Bot WhatsApp...');
client.initialize();
