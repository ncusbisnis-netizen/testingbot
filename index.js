const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');

// ============= KONFIGURASI =============
const TOKEN = process.env.BOT_TOKEN || 'TOKEN_BOT_ANDA';
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 123456789;
const ALLOWED_GROUPS_FILE = './allowed_groups.json';

// Inisialisasi bot
const bot = new TelegramBot(TOKEN, { 
    polling: false // Matikan polling, pakai webhook
});

// ============= FUNGSI BANTUAN =============

// Load daftar grup yang diizinkan
function loadAllowedGroups() {
    try {
        if (fs.existsSync(ALLOWED_GROUPS_FILE)) {
            const data = fs.readFileSync(ALLOWED_GROUPS_FILE, 'utf8');
            return new Set(JSON.parse(data));
        }
    } catch (error) {
        console.error('Error loading groups:', error);
    }
    return new Set();
}

// Simpan daftar grup yang diizinkan
function saveAllowedGroups(groups) {
    try {
        fs.writeFileSync(ALLOWED_GROUPS_FILE, JSON.stringify([...groups]), 'utf8');
    } catch (error) {
        console.error('Error saving groups:', error);
    }
}

// Inisialisasi allowedGroups
let allowedGroups = loadAllowedGroups();

// Cek apakah user adalah admin
function isAdmin(userId) {
    return userId === ADMIN_ID;
}

// Cek apakah grup diizinkan
function isGroupAllowed(chatId) {
    return allowedGroups.has(chatId);
}

// ============= MIDDLEWARE =============

// Middleware untuk cek akses grup
async function checkGroupAccess(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Admin bot bisa akses di mana saja
    if (isAdmin(userId)) {
        return true;
    }
    
    // Jika chat pribadi, non-admin tidak bisa akses
    if (msg.chat.type === 'private') {
        await bot.sendMessage(chatId, '❌ Maaf, bot ini hanya untuk admin.');
        return false;
    }
    
    // Jika di grup, cek apakah grup diizinkan
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
        if (!isGroupAllowed(chatId)) {
            await bot.sendMessage(chatId, '❌ Bot ini hanya dapat digunakan di grup yang telah terdaftar.\nHubungi admin untuk menambahkan grup ini.');
            return false;
        }
        return true;
    }
    
    return false;
}

// ============= COMMAND HANDLERS =============

// Command /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Cek akses
    if (!await checkGroupAccess(msg)) return;
    
    await bot.sendMessage(chatId, 
        '✅ *Bot Aktif!*\n\n' +
        'Perintah yang tersedia:\n' +
        '• /start - Menampilkan pesan selamat datang\n' +
        '• /help - Bantuan penggunaan bot',
        { parse_mode: 'Markdown' }
    );
});

// Command /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!await checkGroupAccess(msg)) return;
    
    const helpText = 
        '📋 *DAFTAR PERINTAH*\n\n' +
        '*Untuk Semua Member Grup:*\n' +
        '• /start - Mulai bot\n' +
        '• /help - Tampilkan bantuan\n\n' +
        '*Khusus Admin Bot (Bisa di Grup atau Private Chat):*\n' +
        '• `/idgrup` - Lihat ID grup ini (ketik di grup)\n' +
        '• `/idgrup @username` - Lihat ID grup public\n' +
        '• `/idgrup https://t.me/+kode` - Lihat ID via link\n' +
        '• *Reply pesan* dengan `/idgrup` - Untuk grup private\n' +
        '• `/addakses ID_GRUP` - Tambah akses grup\n' +
        '• `/removeakses ID_GRUP` - Hapus akses grup\n' +
        '• `/listakses` - Lihat semua grup terdaftar\n' +
        '• `/status` - Cek status bot';
    
    await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// Command /idgrup - KHUSUS ADMIN BOT (VERSION FINAL - MUDAH!)
bot.onText(/\/idgrup(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    
    // ============= CEK AKSES =============
    
    // Hanya admin bot yang bisa
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Perintah ini hanya untuk ADMIN BOT!');
    }
    
    // ============= KALAU DI GRUP =============
    if (isGroup) {
        // Cek apakah grup sudah terdaftar
        if (!isGroupAllowed(chatId)) {
            return bot.sendMessage(chatId, '❌ Grup ini belum terdaftar. Tambah dulu dengan /addakses di private chat.');
        }
        
        // TAMPILKAN ID GRUP INI!
        const chat = msg.chat;
        
        // Ambil jumlah member
        let memberCount = 'Tidak diketahui';
        try {
            memberCount = await bot.getChatMembersCount(chatId);
        } catch (e) {}
        
        const infoText = 
            `📊 *INFORMASI GRUP INI*\n` +
            `==================\n\n` +
            `📌 *Nama Grup:* ${chat.title}\n` +
            `🆔 *ID Grup:* \`${chatId}\`\n` +
            `👥 *Total Member:* ${memberCount}\n` +
            `🔗 *Tipe Grup:* ${chat.type === 'supergroup' ? 'Supergroup' : 'Group'}\n` +
            `📝 *Deskripsi:* ${chat.description || 'Tidak ada'}\n` +
            `🌐 *Username:* ${chat.username ? '@' + chat.username : 'Tidak ada (private)'}\n` +
            `🔐 *Private:* ${!chat.username ? 'Ya' : 'Tidak'}\n\n` +
            `✅ *Grup ini sudah terdaftar!*`;
        
        return bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
    }
    
    // ============= KALAU DI PRIVATE CHAT =============
    
    // CEK APAKAH REPLY KE PESAN DARI GRUP
    if (msg.reply_to_message) {
        const repliedMsg = msg.reply_to_message;
        
        // Cek apakah pesan yang direply dari grup
        if (repliedMsg.chat.type === 'group' || repliedMsg.chat.type === 'supergroup') {
            const loadingMsg = await bot.sendMessage(chatId, '🔍 Memproses pesan reply...');
            
            try {
                const chat = repliedMsg.chat;
                
                // Dapatkan jumlah member
                let memberCount = 'Tidak diketahui';
                try {
                    memberCount = await bot.getChatMembersCount(chat.id);
                } catch (e) {}
                
                const infoText = 
                    `📊 *INFORMASI GRUP (Via Reply)*\n` +
                    `==================\n\n` +
                    `📌 *Nama Grup:* ${chat.title}\n` +
                    `🆔 *ID Grup:* \`${chat.id}\`\n` +
                    `👥 *Total Member:* ${memberCount}\n` +
                    `🔗 *Tipe Grup:* ${chat.type === 'supergroup' ? 'Supergroup' : 'Group'}\n` +
                    `📝 *Deskripsi:* ${chat.description || 'Tidak ada'}\n` +
                    `🌐 *Username:* ${chat.username ? '@' + chat.username : 'Tidak ada (private)'}\n` +
                    `🔐 *Private:* ${!chat.username ? 'Ya' : 'Tidak'}\n\n` +
                    `⚡ *Aksi Cepat:*\n` +
                    `• Tambah akses: \`/addakses ${chat.id}\`\n` +
                    `• Hapus akses: \`/removeakses ${chat.id}\``;
                
                await bot.deleteMessage(chatId, loadingMsg.message_id);
                return bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
                
            } catch (error) {
                await bot.deleteMessage(chatId, loadingMsg.message_id);
                return bot.sendMessage(chatId, '❌ Gagal memproses pesan reply.');
            }
        }
    }
    
    // CEK APAKAH ADA PARAMETER (USERNAME ATAU LINK)
    const param = match?.[1];
    
    if (!param) {
        // Tidak ada parameter di private chat
        return bot.sendMessage(chatId,
            '❌ *Kamu di private chat*\n\n' +
            '• Ketik `/idgrup` *di dalam grup* untuk lihat ID grup ini.\n' +
            '• Atau gunakan format:\n' +
            '  `/idgrup @namagrup`\n' +
            '  `/idgrup https://t.me/+kode`\n' +
            '  *Reply pesan* dari grup dengan `/idgrup`',
            { parse_mode: 'Markdown' }
        );
    }
    
    // CEK APAKAH INI LINK TELEGRAM
    if (param.includes('t.me/') || param.includes('telegram.me/')) {
        const loadingMsg = await bot.sendMessage(chatId, '🔍 Memproses link undangan...');
        
        try {
            // Ekstrak kode invite dari link
            let inviteCode = '';
            if (param.includes('t.me/+')) {
                inviteCode = param.split('t.me/+')[1].split(' ')[0].split('?')[0];
            } else if (param.includes('t.me/joinchat/')) {
                inviteCode = param.split('t.me/joinchat/')[1].split(' ')[0].split('?')[0];
            } else {
                // Mungkin username via link
                const username = param.split('t.me/')[1].split(' ')[0].split('?')[0];
                if (username) {
                    try {
                        const chat = await bot.getChat(`@${username}`);
                        const memberCount = await bot.getChatMembersCount(chat.id);
                        
                        const infoText = 
                            `📊 *INFORMASI GRUP (Via Link)*\n` +
                            `==================\n\n` +
                            `📌 *Nama Grup:* ${chat.title}\n` +
                            `🆔 *ID Grup:* \`${chat.id}\`\n` +
                            `👥 *Total Member:* ${memberCount}\n` +
                            `🌐 *Username:* @${chat.username}\n\n` +
                            `⚡ *Aksi Cepat:*\n` +
                            `• Tambah akses: \`/addakses ${chat.id}\``;
                        
                        await bot.deleteMessage(chatId, loadingMsg.message_id);
                        return bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
                        
                    } catch (e) {
                        // Bukan username, lanjut
                    }
                }
            }
            
            await bot.deleteMessage(chatId, loadingMsg.message_id);
            return bot.sendMessage(chatId,
                `⚠️ *Untuk grup private dengan link undangan:*\n\n` +
                `Bot tidak bisa mendapatkan ID langsung dari link undangan karena Telegram membatasi akses.\n\n` +
                `📌 *Cara alternatif:*\n` +
                `1️⃣ Minta seseorang di grup untuk forward pesan ke sini\n` +
                `2️⃣ Reply pesan tersebut dengan /idgrup`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            await bot.deleteMessage(chatId, loadingMsg.message_id);
            return bot.sendMessage(chatId, '❌ Gagal memproses link.');
        }
    }
    
    // JIKA BUKAN LINK, ANGGAP USERNAME
    const cleanUsername = param.replace('@', '');
    
    const loadingMsg = await bot.sendMessage(chatId, '🔍 Mencari informasi grup...');
    
    try {
        const chat = await bot.getChat(`@${cleanUsername}`);
        
        let memberCount = 'Tidak diketahui';
        try {
            memberCount = await bot.getChatMembersCount(chat.id);
        } catch (e) {}
        
        const infoText = 
            `📊 *INFORMASI GRUP*\n` +
            `==================\n\n` +
            `📌 *Nama Grup:* ${chat.title}\n` +
            `🆔 *ID Grup:* \`${chat.id}\`\n` +
            `👥 *Total Member:* ${memberCount}\n` +
            `🌐 *Username:* @${chat.username}\n` +
            `🔐 *Private:* ${!chat.username ? 'Ya' : 'Tidak'}\n\n` +
            `⚡ *Aksi Cepat:*\n` +
            `• Tambah akses: \`/addakses ${chat.id}\``;
        
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        return bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
        
    } catch (error) {
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        
        let errorMsg = '❌ ';
        if (error.response && error.response.body) {
            try {
                const body = JSON.parse(error.response.body);
                if (body.description.includes('chat not found')) {
                    errorMsg += `Grup @${cleanUsername} tidak ditemukan!\n\n` +
                                `Kemungkinan:\n` +
                                `• Username salah\n` +
                                `• Grup adalah private (tidak punya username)`;
                } else {
                    errorMsg += body.description;
                }
            } catch {
                errorMsg += 'Terjadi kesalahan.';
            }
        } else {
            errorMsg += 'Terjadi kesalahan.';
        }
        
        return bot.sendMessage(chatId, errorMsg);
    }
});

// Command /addakses - Tambah grup ke whitelist
bot.onText(/\/addakses (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Hanya admin yang bisa
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Perintah ini hanya untuk admin.');
    }
    
    const groupId = parseInt(match[1]);
    
    if (isNaN(groupId)) {
        return bot.sendMessage(chatId, '❌ ID grup harus berupa angka!');
    }
    
    // Tambahkan ke daftar
    allowedGroups.add(groupId);
    saveAllowedGroups(allowedGroups);
    
    // Coba dapatkan info grup
    try {
        const chat = await bot.getChat(groupId);
        return bot.sendMessage(chatId,
            `✅ *GRUP DITAMBAHKAN*\n\n` +
            `📌 Nama: ${chat.title}\n` +
            `🆔 ID: \`${groupId}\`\n` +
            `📊 Total grup terdaftar: ${allowedGroups.size}`,
            { parse_mode: 'Markdown' }
        );
    } catch {
        return bot.sendMessage(chatId,
            `✅ *GRUP DITAMBAHKAN*\n\n` +
            `🆔 ID: \`${groupId}\`\n` +
            `📊 Total grup terdaftar: ${allowedGroups.size}\n\n` +
            `⚠️ Bot belum diundang ke grup ini.`,
            { parse_mode: 'Markdown' }
        );
    }
});

// Command /removeakses - Hapus grup dari whitelist
bot.onText(/\/removeakses (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Hanya admin yang bisa
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Perintah ini hanya untuk admin.');
    }
    
    const groupId = parseInt(match[1]);
    
    if (isNaN(groupId)) {
        return bot.sendMessage(chatId, '❌ ID grup harus berupa angka!');
    }
    
    if (allowedGroups.has(groupId)) {
        allowedGroups.delete(groupId);
        saveAllowedGroups(allowedGroups);
        
        return bot.sendMessage(chatId,
            `✅ *GRUP DIHAPUS*\n\n` +
            `🆔 ID: \`${groupId}\`\n` +
            `📊 Sisa grup terdaftar: ${allowedGroups.size}`,
            { parse_mode: 'Markdown' }
        );
    } else {
        return bot.sendMessage(chatId, '❌ Grup tidak ditemukan dalam daftar akses!');
    }
});

// Command /listakses - Lihat semua grup terdaftar
bot.onText(/\/listakses/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Hanya admin yang bisa
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Perintah ini hanya untuk admin.');
    }
    
    if (allowedGroups.size === 0) {
        return bot.sendMessage(chatId, '📋 Belum ada grup yang terdaftar.');
    }
    
    const loadingMsg = await bot.sendMessage(chatId, '📊 Mengambil daftar grup...');
    
    let groupsList = [];
    let index = 1;
    
    for (const gid of allowedGroups) {
        try {
            const chat = await bot.getChat(gid);
            groupsList.push(`${index}. *${chat.title}*\n   🆔 \`${gid}\`\n   Status: ✅ Aktif`);
        } catch {
            groupsList.push(`${index}. *Grup tidak dapat diakses*\n   🆔 \`${gid}\`\n   Status: ❌ Bot tidak ada di grup`);
        }
        index++;
    }
    
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    const text = 
        `📋 *DAFTAR GRUP TERDAFTAR*\n` +
        `=====================\n` +
        `Total: ${allowedGroups.size} grup\n\n` +
        groupsList.join('\n\n');
    
    return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// Command /status - Cek status bot
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Hanya admin yang bisa
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Perintah ini hanya untuk admin.');
    }
    
    const status = 
        `📊 *STATUS BOT*\n\n` +
        `• Status: ✅ Online\n` +
        `• Total grup terdaftar: ${allowedGroups.size}\n` +
        `• Mode: Production\n` +
        `• Waktu: ${new Date().toLocaleString('id-ID')}`;
    
    return bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
});

// Handler untuk pesan yang tidak dikenal
bot.on('message', async (msg) => {
    // Abaikan command yang sudah ditangani
    if (msg.text && msg.text.startsWith('/')) return;
    
    // Cek akses untuk pesan biasa
    await checkGroupAccess(msg);
});

// ============= ERROR HANDLER =============
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error);
});

// ============= SETUP WEBHOOK & SERVER =============
console.log('🤖 Bot started...');

// Setup Express server untuk Heroku
const app = express();
const port = process.env.PORT || 3000;

// Middleware untuk parse JSON
app.use(express.json());

// Route untuk cek status
app.get('/', (req, res) => {
    res.send('Bot is running! 🚀');
});

// Route untuk webhook Telegram
app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Set webhook ke Telegram
const appName = process.env.HEROKU_APP_NAME || 'testerbot-074c15ac0dd7';
const webhookUrl = `https://${appName}.herokuapp.com/bot${TOKEN}`;

bot.setWebHook(webhookUrl).then(() => {
    console.log(`Webhook set to: ${webhookUrl}`);
}).catch(err => {
    console.error('Failed to set webhook:', err);
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = bot;
