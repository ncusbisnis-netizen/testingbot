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
    
    // Jika chat pribadi, hanya admin yang bisa akses
    if (msg.chat.type === 'private') {
        if (!isAdmin(userId)) {
            await bot.sendMessage(chatId, '❌ Maaf, bot ini hanya untuk admin.');
            return false;
        }
        return true;
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
        '*Khusus Admin Bot (Private Chat):*\n' +
        '• `/idgrup @username` - Lihat ID grup\n' +
        '• `/addakses ID_GRUP` - Tambah akses grup\n' +
        '• `/removeakses ID_GRUP` - Hapus akses grup\n' +
        '• `/listakses` - Lihat semua grup terdaftar\n' +
        '• `/status` - Cek status bot';
    
    await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// Command /idgrup [username] - KHUSUS ADMIN
bot.onText(/\/idgrup(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Hanya admin yang bisa akses di private chat
    if (msg.chat.type !== 'private' || !isAdmin(userId)) {
        await bot.sendMessage(chatId, '❌ Perintah ini hanya untuk admin di private chat.');
        return;
    }
    
    const username = match[1];
    
    if (!username) {
        await bot.sendMessage(chatId,
            '❌ *Format salah!*\n\n' +
            'Gunakan: `/idgrup @username_grup`\n' +
            'Contoh: `/idgrup @python_indonesia`\n\n' +
            '📌 *Tips:*\n' +
            '• Username bisa dengan atau tanpa @\n' +
            '• Pastikan grup memiliki username publik',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Bersihkan username dari @
    const cleanUsername = username.replace('@', '');
    
    // Kirim status loading
    const loadingMsg = await bot.sendMessage(chatId, '🔍 Mencari informasi grup...');
    
    try {
        // Dapatkan info grup
        const chat = await bot.getChat(`@${cleanUsername}`);
        
        // Dapatkan jumlah member
        let memberCount = 'Tidak diketahui';
        try {
            memberCount = await bot.getChatMembersCount(chat.id);
        } catch (e) {
            console.log('Gagal get member count');
        }
        
        // Format pesan
        const infoText = 
            `📊 *INFORMASI GRUP*\n` +
            `==================\n\n` +
            `📌 *Nama Grup:* ${chat.title}\n` +
            `🆔 *ID Grup:* \`${chat.id}\`\n` +
            `🔗 *Tipe Grup:* ${chat.type === 'supergroup' ? 'Supergroup' : 'Group'}\n` +
            `👥 *Total Member:* ${memberCount}\n` +
            `📝 *Deskripsi:* ${chat.description || 'Tidak ada'}\n` +
            `🌐 *Username:* @${chat.username}\n` +
            `🔐 *Private:* ${!chat.username ? 'Ya' : 'Tidak'}\n\n` +
            `⚡ *Aksi Cepat:*\n` +
            `• Tambah akses: \`/addakses ${chat.id}\`\n` +
            `• Hapus akses: \`/removeakses ${chat.id}\``;
        
        // Hapus pesan loading
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        
        // Kirim informasi
        await bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
        
        console.log(`Admin ${userId} cek grup @${cleanUsername} (ID: ${chat.id})`);
        
    } catch (error) {
        // Hapus pesan loading
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        
        let errorMsg = '❌ ';
        if (error.response && error.response.body) {
            try {
                const body = JSON.parse(error.response.body);
                if (body.description.includes('chat not found')) {
                    errorMsg += `Grup @${cleanUsername} tidak ditemukan!\n\nPastikan:\n• Username benar\n• Grup memiliki username publik`;
                } else {
                    errorMsg += body.description;
                }
            } catch {
                errorMsg += 'Terjadi kesalahan. Silakan coba lagi.';
            }
        } else {
            errorMsg += 'Terjadi kesalahan. Silakan coba lagi.';
        }
        
        await bot.sendMessage(chatId, errorMsg);
    }
});

// Command /addakses - Tambah grup ke whitelist
bot.onText(/\/addakses (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Hanya admin di private chat
    if (msg.chat.type !== 'private' || !isAdmin(userId)) return;
    
    const groupId = parseInt(match[1]);
    
    if (isNaN(groupId)) {
        await bot.sendMessage(chatId, '❌ ID grup harus berupa angka!');
        return;
    }
    
    // Tambahkan ke daftar
    allowedGroups.add(groupId);
    saveAllowedGroups(allowedGroups);
    
    // Coba dapatkan info grup
    try {
        const chat = await bot.getChat(groupId);
        await bot.sendMessage(chatId,
            `✅ *GRUP DITAMBAHKAN*\n\n` +
            `📌 Nama: ${chat.title}\n` +
            `🆔 ID: \`${groupId}\`\n` +
            `📊 Total grup terdaftar: ${allowedGroups.size}`,
            { parse_mode: 'Markdown' }
        );
    } catch {
        await bot.sendMessage(chatId,
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
    
    // Hanya admin di private chat
    if (msg.chat.type !== 'private' || !isAdmin(userId)) return;
    
    const groupId = parseInt(match[1]);
    
    if (isNaN(groupId)) {
        await bot.sendMessage(chatId, '❌ ID grup harus berupa angka!');
        return;
    }
    
    if (allowedGroups.has(groupId)) {
        allowedGroups.delete(groupId);
        saveAllowedGroups(allowedGroups);
        
        await bot.sendMessage(chatId,
            `✅ *GRUP DIHAPUS*\n\n` +
            `🆔 ID: \`${groupId}\`\n` +
            `📊 Sisa grup terdaftar: ${allowedGroups.size}`,
            { parse_mode: 'Markdown' }
        );
    } else {
        await bot.sendMessage(chatId, '❌ Grup tidak ditemukan dalam daftar akses!');
    }
});

// Command /listakses - Lihat semua grup terdaftar
bot.onText(/\/listakses/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Hanya admin di private chat
    if (msg.chat.type !== 'private' || !isAdmin(userId)) return;
    
    if (allowedGroups.size === 0) {
        await bot.sendMessage(chatId, '📋 Belum ada grup yang terdaftar.');
        return;
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
    
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// Command /status - Cek status bot
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (msg.chat.type !== 'private' || !isAdmin(userId)) return;
    
    const status = 
        `📊 *STATUS BOT*\n\n` +
        `• Status: ✅ Online\n` +
        `• Total grup terdaftar: ${allowedGroups.size}\n` +
        `• Mode: Production\n` +
        `• Waktu: ${new Date().toLocaleString('id-ID')}`;
    
    await bot.sendMessage(chatId, status, { parse_mode: 'Markdown' });
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
