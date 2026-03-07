const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== KONFIGURASI ==========
const PREFIX = process.env.PREFIX || '!';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '6283133199990'; // Dari session ID Anda
const SESSION_NAME = process.env.SESSION_NAME || 'whatsapp-session';

// ========== BUAT FOLDER SESSION ==========
const sessionPath = path.join(__dirname, '.wwebjs_auth', SESSION_NAME);
const sessionDataPath = path.join(sessionPath, 'Default');
const sessionFile = path.join(sessionDataPath, 'Session');

// ========== DATA SESSION ANDA ==========
const sessionData = {
    WABrowserId: "13482392238087",
    WASecretBundle: "eyJub2lzZUtleSI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoieUtoUmU5dDgyWkMxL0FYTGx6cStzWE1yZi9ET1pVcS9LcTdpWENTME4yST0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiYStlR01JZDl6ZktqbjljYWRYKzZ6NHZPcWRWbVZyZHkyS09oWE1yYWtDdz0ifX0sInBhaXJpbmdFcGhlbWVyYWxLZXlQYWlyIjp7InByaXZhdGUiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiIySnB6eStKZzlDNlE5bXlreFdqR3dlbW5raVU3d25sMUVRODcxamtLUkd3PSJ9LCJwdWJsaWMiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJHR0F1OHNFb3M3aWtXam81VDZ1UnByUE9aY0MzQWdnSGhHaFllcVgzSG5BPSJ9fSwic2lnbmVkSWRlbnRpdHlLZXkiOnsicHJpdmF0ZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IldLWXMwcjRwaVo5dm5lTmtla2pNZ0I5aHNUOXkvRzFrN2hDbE4wQ2dVWE09In0sInB1YmxpYyI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6InpqamRoRDZnNmRvVHdtOHdCZzFXOWIzUFZkL3VHc1N2d1dveDdQSWNIbUE9In19LCJzaWduZWRQcmVLZXkiOnsia2V5UGFpciI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiT1B6M0ZwSEFYS2hGMDZ5eDJ0NHdYVVhzemlkdmVPL24vZmtNMXNlcUVXUT0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoibWdqa3kwbWdvS0IvTkNRMlQxd3ltd2dscFlPRk14dHE4RHR1ZlBScUozWT0ifX0sInNpZ25hdHVyZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6Ijk4S3dPcGNFdERnRzZGU3Q4dFZ3eWhqY1IvcUUxV2o4ZGc1R3QxNTNnN0VJWjdDcXREMFRabUZpdWhLdmhSQlEyTUtLL0pPYkYwUDFKM2pOZzhjUmhnPT0ifSwia2V5SWQiOjF9LCJyZWdpc3RyYXRpb25JZCI6MTg3LCJhZHZTZWNyZXRLZXkiOiIyVVJSSXpCSU1JcHJES2U1T2hKMTdlMlFCdEhLck1FWDJpUC84bCswOVVrPSIsInByb2Nlc3NlZEhpc3RvcnlNZXNzYWdlcyI6W10sIm5leHRQcmVLZXlJZCI6MzEsImZpcnN0VW51cGxvYWRlZFByZUtleUlkIjozMSwiYWNjb3VudFN5bmNDb3VudGVyIjowLCJhY2NvdW50U2V0dGluZ3MiOnsidW5hcmNoaXZlQ2hhdHMiOmZhbHNlfSwicmVnaXN0ZXJlZCI6dHJ1ZSwicGFpcmluZ0NvZGUiOiJLNEtUTjJMOCIsIm1lIjp7ImlkIjoiNjI4MzEzMzE5OTk5MDo0QHMud2hhdHNhcHAubmV0IiwibmFtZSI6Ik5jdXMiLCJsaWQiOiIxMzQ4MjM5MjIzODA4NzA6NEBsaWQifSwiYWNjb3VudCI6eyJkZXRhaWxzIjoiQ01udTY3a0JFUFhucnMwR0dBSWdBQ2dBIiwiYWNjb3VudFNpZ25hdHVyZUtleSI6ImltN2JXTzY2a3JKSnJ0aTF2cjNwSUxNQm94dVVtVkpUVEJIb0NTbXc0a0U9IiwiYWNjb3VudFNpZ25hdHVyZSI6IjVEQndZc1ZFekQ5RUtXWlRWa3cxSjVYM2VwUCt5czhnTklYSlNaWS9Hc00xeTRXUFNsQ3M4c3FBN1dRWW42dTFpOXZuSUJJdG9sVnZ2QVVWbms5c0FBPT0iLCJkZXZpY2VTaWduYXR1cmUiOiJLMzI0WkhTUDAxbnRRenpReHFIVTF6S3NxM0JMRVFoSXRLNW41TTdpbytvdGluNVIrSUkzS2YxOGxkY2dDek4ySkhlM01DVUJsT3dlQ29TekxQWDhndz09In0sInNpZ25hbElkZW50aXRpZXMiOlt7ImlkZW50aWZpZXIiOnsibmFtZSI6IjYyODMxMzMxOTk5OTA6NEBzLndoYXRzYXBwLm5ldCIsImRldmljZUlkIjowfSwiaWRlbnRpZmllcktleSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IkJZcHUyMWp1dXBLeVNhN1l0YjY5NlNDekFhTWJsSmxTVTB3UjZBa3BzT0pCIn19XSwicGxhdGZvcm0iOiJzbWJhIiwicm91dGluZ0luZm8iOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJDQVVJRWdnSSJ9LCJsYXN0QWNjb3VudFN5bmNUaW1lc3RhbXAiOjE3NzI4NjA0MDgsImxhc3RQcm9wSGFzaCI6IjNSOVozOSIsIm15QXBwU3RhdGVLZXlJZCI6IkFBQUFBSEtEIn0=",
    WAToken1: "PdO2a6T0raAw6V1A0InZq2p75Z/FipJvYQZzX2MhZcw=",
    WAToken2: "qGXb7JvhYopx2tTLHheDp7W8X5YhK5ZVnKdHjNhLj2o="
};

// ========== BUAT STRUKTUR FOLDER SESSION ==========
function setupSession() {
    try {
        console.log('\n🔧 SETUP SESSION...');
        
        // Buat folder session jika belum ada
        if (!fs.existsSync(sessionDataPath)) {
            fs.mkdirSync(sessionDataPath, { recursive: true });
            console.log(`📁 Folder session dibuat: ${sessionDataPath}`);
        }
        
        // Simpan data session ke file
        const sessionContent = JSON.stringify(sessionData, null, 2);
        fs.writeFileSync(sessionFile, sessionContent);
        console.log(`✅ File session tersimpan: ${sessionFile}`);
        
        // Cek file
        const stats = fs.statSync(sessionFile);
        console.log(`📦 Ukuran file: ${stats.size} bytes`);
        
        return true;
    } catch (error) {
        console.log('❌ Gagal setup session:', error.message);
        return false;
    }
}

// ========== JALANKAN SETUP SESSION ==========
console.log('\n' + '='.repeat(50));
console.log('🚀 WHATSAPP BOT DENGAN SESSION ID');
console.log('='.repeat(50));

if (setupSession()) {
    console.log('✅ Session siap digunakan!');
    console.log(`👤 Owner: ${OWNER_NUMBER}`);
    console.log(`🔐 Session: ${SESSION_NAME}`);
} else {
    console.log('❌ Gagal setup session, akan scan QR baru');
}
console.log('='.repeat(50));

// ========== INIT BOT ==========
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
            '--disable-gpu',
            '--headless=new'
        ]
    }
});

// ========== QR CODE (HANYA JIKA SESSION ERROR) ==========
client.on('qr', (qr) => {
    console.log('\n📱 SCAN QR INI (SESSION ERROR):');
    qrcode.generate(qr, { small: true });
});

// ========== AUTHENTICATED ==========
client.on('authenticated', () => {
    console.log('✅ Authentication berhasil!');
});

// ========== READY ==========
client.on('ready', () => {
    console.log('\n✅ BOT SIAP DIGUNAKAN!');
    console.log('='.repeat(50));
    console.log(`📱 Nomor: ${client.info.wid.user}`);
    console.log(`👤 Owner: ${OWNER_NUMBER}`);
    console.log(`⚡ Prefix: ${PREFIX}`);
    console.log('='.repeat(50));
});

// ========== HANDLER PESAN ==========
client.on('message', async (msg) => {
    try {
        if (msg.from === 'status@broadcast') return;
        
        const chat = await msg.getChat();
        const message = msg.body;
        const isGroup = chat.isGroup;
        
        if (!message.startsWith(PREFIX)) return;
        
        const args = message.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        // ========== COMMAND ==========
        
        if (command === 'menu') {
            let menu = `🤖 *MENU BOT*\n\n`;
            menu += `┌ *${PREFIX}menu* - Menu ini\n`;
            menu += `├ *${PREFIX}ping* - Cek bot\n`;
            menu += `├ *${PREFIX}info* - Info bot\n`;
            
            if (isGroup) {
                menu += `├ *${PREFIX}idgrup* - ID grup\n`;
            }
            
            menu += `└ *${PREFIX}owner* - Kontak owner\n\n`;
            menu += `_Bot by @${OWNER_NUMBER}_`;
            
            await msg.reply(menu);
        }
        
        else if (command === 'ping') {
            await msg.reply('🏓 Pong!');
        }
        
        else if (command === 'info') {
            await msg.reply(`📱 Bot aktif di ${client.info.wid.user}`);
        }
        
        else if (command === 'idgrup' && isGroup) {
            await msg.reply(`📊 ID Grup: ${chat.id._serialized}`);
        }
        
        else if (command === 'owner') {
            await msg.reply(`👑 Owner: @${OWNER_NUMBER}`);
        }
        
        else if (command === 'ceksession' && msg.from.includes(OWNER_NUMBER)) {
            const exists = fs.existsSync(sessionFile);
            let reply = `🔐 *CEK SESSION*\n\n`;
            reply += `Nama: ${SESSION_NAME}\n`;
            reply += `Lokasi: ${sessionFile}\n`;
            reply += `Status: ${exists ? '✅ Ada' : '❌ Tidak ada'}\n`;
            
            if (exists) {
                const stats = fs.statSync(sessionFile);
                reply += `Ukuran: ${stats.size} bytes\n`;
                reply += `Dibuat: ${stats.birthtime.toLocaleString()}`;
            }
            
            await msg.reply(reply);
        }
        
    } catch (error) {
        console.log('Error:', error.message);
    }
});

// ========== WEB SERVER ==========
app.get('/', (req, res) => {
    const sessionExists = fs.existsSync(sessionFile);
    
    res.send(`
        <html>
        <head><title>WA Bot</title></head>
        <body style="font-family: Arial; padding: 20px;">
            <h1>🤖 WhatsApp Bot</h1>
            <p>Status: ${client.info ? '🟢 Online' : '🔴 Offline'}</p>
            <p>Nomor: ${client.info ? client.info.wid.user : '-'}</p>
            <p>Session: ${sessionExists ? '✅' : '❌'}</p>
            <p>Owner: ${OWNER_NUMBER}</p>
            <hr>
            <pre>Session file: ${sessionFile}</pre>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web: http://localhost:${PORT}`);
});

// ========== START BOT ==========
console.log('🚀 Starting bot...');
client.initialize();
