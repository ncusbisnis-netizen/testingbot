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

function extractTextFromMessage(message) {
  if (!message) return '';
  const m = message;
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage) return m.extendedTextMessage.text;
  if (m.imageMessage) return m.imageMessage.caption || '';
  if (m.videoMessage) return m.videoMessage.caption || '';
  if (m.documentMessage) return m.documentMessage.caption || '';
  if (m.ephemeralMessage) return extractTextFromMessage(m.ephemeralMessage.message);
  if (m.viewOnceMessage) return extractTextFromMessage(m.viewOnceMessage.message);
  return '';
}

async function startBot() {
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
    printQRInTerminal: false,
    browser: ["Bot", "Chrome", "1.0"],
    markOnlineOnConnect: true,
    logger: P({ level: "silent" })
  });

  store.bind(sock.ev);

  let botNumber;

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
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
      if (msg.key.remoteJid === "status@broadcast") return;

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");

      if (botNumber && sender === botNumber) return;

      const rawText = extractTextFromMessage(msg.message);
      if (!rawText) return;

      const body = rawText.toLowerCase();
      console.log(`📩 Pesan dari ${sender} di ${from}: ${body}`);

      // Tandai telah dibaca (jika gagal, tetap lanjut)
      try {
        await sock.readMessages([msg.key]);
      } catch (readErr) {
        console.log("⚠️ Gagal menandai baca:", readErr.message);
      }

      // Normalisasi perintah
      let command = body;
      if (command.startsWith('!')) command = command.slice(1);

      // ========== PERINTAH PING ==========
      if (command === "ping") {
        console.log("⚡ Menjalankan perintah ping, mengirim ke:", from);
        try {
          await sock.sendMessage(from, { text: "pong 🏓" });
          console.log("✅ Pesan pong terkirim ke", from);
        } catch (sendErr) {
          console.error("❌ Gagal mengirim pong:", sendErr);
        }
      }

      // ========== PERINTAH MENU ==========
      if (command === "menu") {
        console.log("📋 Menjalankan perintah menu");
        try {
          await sock.sendMessage(from, {
            text: `🤖 *MENU BOT*\n\n• ping\n• menu\n• idgrup\n• tagall\n\nGunakan dengan atau tanpa awalan '!'`
          });
        } catch (sendErr) {
          console.error("❌ Gagal mengirim menu:", sendErr);
        }
      }

      // ========== PERINTAH ID GRUP ==========
      if (command === "idgrup") {
        if (!isGroup) {
          await sock.sendMessage(from, { text: "❌ Perintah ini hanya bisa digunakan di grup." });
          return;
        }
        try {
          await sock.sendMessage(from, { text: `📌 *ID Grup:*\n\`${from}\`` });
        } catch (sendErr) {
          console.error("❌ Gagal mengirim idgrup:", sendErr);
        }
      }

      // ========== PERINTAH TAGALL ==========
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
          console.log("✅ Tagall terkirim ke", from);
        } catch (err) {
          console.error("❌ Gagal tagall:", err);
          await sock.sendMessage(from, { text: "❌ Gagal melakukan tagall." }).catch(e => {});
        }
      }

    } catch (err) {
      console.error("❌ Error di handler pesan:", err);
    }
  });
}

startBot().catch(err => {
  console.error("❌ Fatal error:", err);
});
