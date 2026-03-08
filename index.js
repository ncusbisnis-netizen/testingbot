global.crypto = require("crypto");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeInMemoryStore
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");

const OWNER = ["6281234567890@s.whatsapp.net"]; // Ganti dengan nomor owner

const store = makeInMemoryStore({
  logger: P().child({ level: "silent", stream: "store" })
});

/**
 * Ekstrak teks dari berbagai tipe pesan WhatsApp
 * @param {Object} message - Pesan dari Baileys (msg.message)
 * @returns {string}
 */
function extractTextFromMessage(message) {
  if (!message) return '';

  const m = message;

  // Pesan biasa
  if (m.conversation) return m.conversation;

  // Extended text (termasuk reply)
  if (m.extendedTextMessage) return m.extendedTextMessage.text;

  // Caption pada media
  if (m.imageMessage) return m.imageMessage.caption || '';
  if (m.videoMessage) return m.videoMessage.caption || '';
  if (m.documentMessage) return m.documentMessage.caption || '';
  if (m.audioMessage) return ''; // audio tidak punya caption
  if (m.stickerMessage) return '';

  // Pesan ephemeral (view once, dll)
  if (m.ephemeralMessage) return extractTextFromMessage(m.ephemeralMessage.message);
  if (m.viewOnceMessage) return extractTextFromMessage(m.viewOnceMessage.message);

  // Pesan interaktif (button, list, dll)
  if (m.buttonsResponseMessage) return m.buttonsResponseMessage.selectedButtonId || '';
  if (m.listResponseMessage) return m.listResponseMessage.singleSelectReply?.selectedRowId || '';
  if (m.templateButtonReplyMessage) return m.templateButtonReplyMessage.selectedId || '';

  // Pesan dengan konteks (forwarded, dll) – mungkin tidak perlu, tapi amankan
  if (m.messageContextInfo) {
    // coba cari di child
    for (let key in m) {
      if (typeof m[key] === 'object' && m[key] !== null) {
        const childText = extractTextFromMessage({ [key]: m[key] }); // rekusif sederhana
        if (childText) return childText;
      }
    }
  }

  return '';
}

async function startBot() {
  // Load session dari environment variable jika ada
  if (process.env.SESSION && !fs.existsSync("./session/creds.json")) {
    try {
      const session = JSON.parse(
        Buffer.from(process.env.SESSION, "base64").toString()
      );
      fs.mkdirSync("./session", { recursive: true });
      fs.writeFileSync("./session/creds.json", JSON.stringify(session, null, 2));
      console.log("✅ SESSION LOADED FROM ENV");
    } catch (err) {
      console.error("❌ Gagal memuat session dari env:", err);
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // jika ingin QR ditampilkan, ubah jadi true
    browser: ["Bot", "Chrome", "1.0"],
    markOnlineOnConnect: true,
    logger: P({ level: "silent" })
  });

  store.bind(sock.ev);

  // Simpan nomor bot setelah koneksi terbuka
  let botNumber;

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Jika QR diperlukan dan printQRInTerminal=false, kita bisa tampilkan manual
    if (qr) {
      console.log("📲 Scan QR ini dengan WhatsApp Anda:");
      console.log(qr);
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("🔄 Koneksi terputus, mencoba reconnect...");
        startBot();
      }
    }

    if (connection === "open") {
      console.log("✅ BOT CONNECTED");
      // Ambil nomor bot dari user.id
      if (sock.user && sock.user.id) {
        botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        console.log("🤖 Nomor bot:", botNumber);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg.message) return;
      if (msg.key.remoteJid === "status@broadcast") return; // Abaikan status

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");

      // Abaikan pesan dari bot sendiri
      if (botNumber && sender === botNumber) return;

      // Ekstrak teks pesan
      const rawText = extractTextFromMessage(msg.message);
      if (!rawText) return;

      const body = rawText.toLowerCase();
      console.log(`📩 Pesan dari ${sender} di ${from}: ${body}`);

      // Tandai pesan telah dibaca
      await sock.readMessages([msg.key]);

      // === NORMALISASI PERINTAH ===
      // Hapus awalan '!' jika ada
      let command = body;
      if (command.startsWith('!')) command = command.slice(1);

      // === DAFTAR PERINTAH ===
      if (command === "ping") {
        await sock.sendMessage(from, { text: "pong 🏓" });
      }

      if (command === "menu") {
        await sock.sendMessage(from, {
          text: `🤖 *MENU BOT*\n\n` +
                `• ping\n` +
                `• menu\n` +
                `• idgrup\n` +
                `• tagall\n\n` +
                `Gunakan dengan atau tanpa awalan '!'`
        });
      }

      if (command === "idgrup") {
        if (!isGroup) {
          return sock.sendMessage(from, { text: "❌ Perintah ini hanya bisa digunakan di grup." });
        }
        await sock.sendMessage(from, {
          text: `📌 *ID Grup:*\n\`${from}\``
        });
      }

      if (command === "tagall") {
        if (!isGroup) return;

        try {
          const group = await sock.groupMetadata(from);
          const members = group.participants.map(p => p.id);
          let teks = "📢 *TAG ALL*\n\n";
          for (let m of members) {
            teks += "@" + m.split("@")[0] + "\n";
          }
          await sock.sendMessage(from, {
            text: teks,
            mentions: members
          });
        } catch (err) {
          console.error("Gagal tagall:", err);
          await sock.sendMessage(from, { text: "❌ Gagal melakukan tagall." });
        }
      }

      // Tambahkan perintah lain di sini

    } catch (err) {
      console.error("❌ Error di handler pesan:", err);
    }
  });
}

// Jalankan bot
startBot().catch(err => {
  console.error("❌ Fatal error:", err);
});
