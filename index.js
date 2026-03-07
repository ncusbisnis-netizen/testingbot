const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== KONFIGURASI ==========
const PREFIX = process.env.PREFIX || '!';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '628123456789';
const SESSION_NAME = process.env.SESSION_NAME || 'heroku-session';

// ========== CEK SESSION ==========
const sessionPath = path.join(__dirname, '.wwebjs_auth', SESSION_NAME);
if (fs.existsSync(sessionPath)) {
    console.log('✅ Session ditemukan! Tidak perlu scan QR');
} else {
    console.log('📱 Session belum ada, siap scan QR');
}

// ========== INIT BOT DENGAN KONFIGURASI KHUSUS HEROKU ==========
console.log('🚀 Memulai bot...');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: SESSION_NAME
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-features=VizDisplayCompositor',
            '--window-size=1920,1080',
            '--remote-debugging-port=9222'
        ],
        executablePath: process.env.GOOGLE_CHROME_BIN || null
    }
});

// ========== EVENT QR CODE ==========
client.on('qr', (qr) => {
    console.log('\n' + '='.repeat(50));
    console.log('📱 SCAN QR CODE INI DENGAN WHATSAPP ANDA:');
    console.log('='.repeat(50));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(50));
    console.log('⏱️ QR Code akan expired dalam 60 detik');
    console.log('📌 Cara scan: WhatsApp > 3 titik > Perangkat tertaut');
});

// ========== EVENT AUTHENTICATED ==========
client.on('authenticated', () => {
    console.log('✅ Authentication berhasil!');
    console.log(`📁 Session tersimpan di: ${sessionPath}`);
});

// ========== EVENT READY ==========
client.on('ready', () => {
    console.log('\n' + '='.repeat(50));
    console.log('✅ BOT WHATSAPP SIAP DIGUNAKAN!');
    console.log('='.repeat(50));
    console.log(`📱 Nomor Bot: ${client.info.wid.user}`);
    console.log(`🔐 Session: ${SESSION_NAME}`);
    console.log(`⚡ Prefix: ${PREFIX}`);
    console.log(`👑 Owner: ${OWNER_NUMBER}`);
    console.log('='.repeat(50));
});

// ========== EVENT DISCONNECTED ==========
client.on('disconnected', (reason) => {
    console.log('❌ BOT TERPUTUS:', reason);
    console.log('🔄 Mencoba reconnect dalam 10 detik...');
    setTimeout(() => {
        console.log('🔄 Reconnecting...');
        client.initialize();
    }, 10000);
});

// ========== FUNGSI FORMAT NOMOR ==========
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
        
        // Log pesan (untuk monitoring)
        if (isGroup) {
            console.log(`👥 [GRUP] ${senderNumber}: ${message}`);
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
            let menu = `╔══════════════════╗\n`;
            menu += `║   *MENU BOT*     ║\n`;
            menu += `╚══════════════════╝\n\n`;
            
            menu += `┌ *${PREFIX}menu* - Tampilkan menu\n`;
            menu += `├ *${PREFIX}ping* - Cek respon bot\n`;
            menu += `├ *${PREFIX}info* - Info bot\n`;
            
            if (isGroup) {
                menu += `├ *${PREFIX}idgrup* - Lihat ID grup\n`;
                menu += `├ *${PREFIX}anggotagrup* - Daftar anggota\n`;
            }
            
            menu += `├ *${PREFIX}say* [teks] - Bot ngomong\n`;
            menu += `├ *${PREFIX}owner* - Kontak owner\n`;
            menu += `└ *${PREFIX}status* - Status bot\n\n`;
            
            menu += `_Bot by @${OWNER_NUMBER}_`;
            
            await msg.reply(menu);
        }
        
        // !ping
        else if (command === 'ping') {
            const start = Date.now();
            await msg.reply('🏓 *Pong!*');
            const end = Date.now();
            await msg.reply(`⏱️ *${end - start}ms*`);
        }
        
        // !info
        else if (command === 'info') {
            const info = `*📱 INFO BOT*\n\n` +
                `├ Nama: WhatsApp Bot Heroku\n` +
                `├ Versi: 2.0.0\n` +
                `├ Prefix: ${PREFIX}\n` +
                `├ Nomor: ${client.info.wid.user}\n` +
                `├ Owner: ${OWNER_NUMBER}\n` +
                `├ Session: ${SESSION_NAME}\n` +
                `└ Status: 🟢 Online`;
            
            await msg.reply(info);
        }
        
        // !say
        else if (command === 'say') {
            if (args.length === 0) {
                await msg.reply(`Contoh: ${PREFIX}say Halo semua`);
                return;
            }
            await msg.reply(args.join(' '));
        }
        
        // !owner
        else if (command === 'owner') {
            await msg.reply(`👑 Owner: @${OWNER_NUMBER}`);
        }
        
        // !status
        else if (command === 'status') {
            const memory = process.memoryUsage();
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            const sessionExists = fs.existsSync(sessionPath);
            
            const status = `*📊 STATUS BOT*\n\n` +
                `├ Uptime: ${hours} jam ${minutes} menit\n` +
                `├ Memory: ${Math.round(memory.heapUsed / 1024 / 1024)} MB\n` +
                `├ Session: ${sessionExists ? '✅ Ada' : '❌ Tidak ada'}\n` +
                `├ Platform: Heroku\n` +
                `└ Node: ${process.version}`;
            
            await msg.reply(status);
        }
        
        // ========== COMMAND GRUP ==========
        
        // !idgrup
        else if (command === 'idgrup' || command === 'idgroup') {
            if (!isGroup) {
                await msg.reply('❌ Perintah ini hanya untuk grup!');
                return;
            }
            
            const response = `📊 *ID GRUP*\n\n` +
                `┌ Nama: ${chat.name}\n` +
                `├ ID: \`${chat.id._serialized}\`\n` +
                `├ Member: ${chat.participants.length} orang\n` +
                `└ Dibuat: ${chat.createdAt ? new Date(chat.createdAt).toLocaleDateString('id-ID') : '-'}`;
            
            await msg.reply(response);
        }
        
        // !anggotagrup
        else if (command === 'anggotagrup' || command === 'members') {
            if (!isGroup) {
                await msg.reply('❌ Perintah ini hanya untuk grup!');
                return;
            }
            
            // Hitung admin
            const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
            
            let response = `👥 *ANGGOTA GRUP*\n\n`;
            response += `┌ Nama Grup: ${chat.name}\n`;
            response += `├ Total: ${chat.participants.length} orang\n`;
            response += `├ Admin: ${admins.length} orang\n`;
            response += `├ Owner: @${formatNumber(chat.owner)}\n`;
            response += `└ ID: \`${chat.id._serialized}\`\n\n`;
            
            response += `_Ketik ${PREFIX}listadmin untuk lihat daftar admin_`;
            
            await msg.reply(response);
        }
        
        // !listadmin
        else if (command === 'listadmin') {
            if (!isGroup) {
                await msg.reply('❌ Perintah ini hanya untuk grup!');
                return;
            }
            
            const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
            
            if (admins.length === 0) {
                await msg.reply('Tidak ada admin di grup ini');
                return;
            }
            
            let response = `👑 *DAFTAR ADMIN*\n\n`;
            admins.forEach((admin, i) => {
                const number = formatNumber(admin.id._serialized);
                response += `${i + 1}. @${number} ${admin.isSuperAdmin ? '(Super Admin)' : ''}\n`;
            });
            
            await msg.reply(response);
        }
        
        // !keluar (khusus admin grup)
        else if (command === 'keluar' && isGroup) {
            // Cek apakah pengirim admin grup
            const isGroupAdmin = chat.participants.some(p => 
                p.id._serialized === sender && (p.isAdmin || p.isSuperAdmin)
            );
            
            if (!isGroupAdmin && !isOwner(sender)) {
                await msg.reply('❌ Hanya admin grup yang bisa mengeluarkan bot');
                return;
            }
            
            await msg.reply('👋 Bot keluar dari grup. Sampai jumpa!');
            await chat.leave();
        }
        
        // ========== COMMAND KHUSUS OWNER ==========
        
        // !restart
        else if (command === 'restart') {
            if (!isOwner(sender)) {
                await msg.reply('❌ Hanya owner!');
                return;
            }
            
            await msg.reply('🔄 Restart bot...');
            console.log('🔄 Restart oleh owner');
            setTimeout(() => process.exit(0), 2000);
        }
        
        // !ceksession
        else if (command === 'ceksession') {
            if (!isOwner(sender)) {
                await msg.reply('❌ Hanya owner!');
                return;
            }
            
            const exists = fs.existsSync(sessionPath);
            let response = `🔐 *INFO SESSION*\n\n`;
            response += `├ Nama: ${SESSION_NAME}\n`;
            response += `├ Status: ${exists ? '✅ Aktif' : '❌ Tidak ada'}\n`;
            
            if (exists) {
                const files = fs.readdirSync(sessionPath);
                response += `├ File: ${files.length} file\n`;
                
                // Cek ukuran
                let totalSize = 0;
                files.forEach(file => {
                    const stats = fs.statSync(path.join(sessionPath, file));
                    totalSize += stats.size;
                });
                response += `└ Ukuran: ${Math.round(totalSize / 1024)} KB`;
            }
            
            await msg.reply(response);
        }
        
        // !hapuSession (reset)
        else if (command === 'hapussession') {
            if (!isOwner(sender)) {
                await msg.reply('❌ Hanya owner!');
                return;
            }
            
            if (!fs.existsSync(sessionPath)) {
                await msg.reply('❌ Session tidak ditemukan');
                return;
            }
            
            try {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                await msg.reply('✅ Session dihapus! Bot akan restart dan minta scan ulang');
                setTimeout(() => process.exit(0), 3000);
            } catch (error) {
                await msg.reply('❌ Gagal hapus session: ' + error.message);
            }
        }
        
    } catch (error) {
        console.log('Error:', error.message);
        await msg.reply('❌ Terjadi kesalahan');
    }
});

// ========== WEB SERVER ==========
app.get('/', (req, res) => {
    const sessionExists = fs.existsSync(sessionPath);
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background: #f0f2f5;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                }
                .card {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }
                h1 {
                    color: #075e54;
                    margin-top: 0;
                }
                .badge {
                    display: inline-block;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: bold;
                    color: white;
                }
                .online { background: #25D366; }
                .offline { background: #f44336; }
                .success { background: #4CAF50; }
                .warning { background: #ff9800; }
                .info {
                    background: #e3f2fd;
                    border-left: 4px solid #2196f3;
                    padding: 12px;
                    border-radius: 4px;
                    margin: 10px 0;
                }
                pre {
                    background: #f5f5f5;
                    padding: 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                }
                .footer {
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>🤖 WhatsApp Bot</h1>
                    
                    <div style="margin-bottom: 20px;">
                        <span class="badge ${client.info ? 'online' : 'offline'}">
                            ${client.info ? 'ONLINE' : 'OFFLINE'}
                        </span>
                        <span class="badge ${sessionExists ? 'success' : 'warning'}" style="margin-left: 10px;">
                            ${sessionExists ? 'SESSION ADA' : 'SESSION BARU'}
                        </span>
                    </div>
                    
                    <div class="info">
                        <strong>📱 Informasi Bot:</strong>
                        <ul style="margin-top: 8px; margin-bottom: 0;">
                            <li><strong>Nomor:</strong> ${client.info ? client.info.wid.user : 'Belum login'}</li>
                            <li><strong>Prefix:</strong> ${PREFIX}</li>
                            <li><strong>Owner:</strong> ${OWNER_NUMBER}</li>
                            <li><strong>Session:</strong> ${SESSION_NAME}</li>
                        </ul>
                    </div>
                    
                    <h3>📋 Command Tersedia:</h3>
                    <pre>
!menu      - Tampilkan menu
!ping      - Cek respon bot
!info      - Info bot
!idgrup    - Lihat ID grup (khusus grup)
!anggotagrup - Info anggota grup
!say [teks] - Bot ngomong
!owner     - Kontak owner
!status    - Status bot
!restart   - Restart bot (owner)
!ceksession - Cek session (owner)
!hapussession - Reset session (owner)
                    </pre>
                    
                    <p><small>Bot by @${OWNER_NUMBER}</small></p>
                </div>
                
                <div class="footer">
                    <p>✅ Bot siap digunakan | Scan QR sekali, session tersimpan</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    const sessionExists = fs.existsSync(sessionPath);
    
    res.json({
        status: 'ok',
        bot: {
            connected: client.info ? true : false,
            number: client.info ? client.info.wid.user : null,
            platform: 'heroku'
        },
        session: {
            name: SESSION_NAME,
            exists: sessionExists,
            path: sessionPath
        },
        config: {
            prefix: PREFIX,
            owner: OWNER_NUMBER
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// ========== HANDLE UNCAUGHT ERRORS ==========
process.on('uncaughtException', (err) => {
    console.log('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.log('❌ Unhandled Rejection:', reason);
});

// ========== START BOT ==========
console.log('\n' + '='.repeat(50));
console.log('🚀 BOT WHATSAPP UNTUK HEROKU');
console.log('='.repeat(50));
console.log('📱 Config:');
console.log(`   Prefix: ${PREFIX}`);
console.log(`   Owner: ${OWNER_NUMBER}`);
console.log(`   Session: ${SESSION_NAME}`);
console.log('='.repeat(50));

client.initialize();
