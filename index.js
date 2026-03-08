global.crypto = require("crypto");

const {
  default: makeWASocket,
  useSingleFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeInMemoryStore
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");

const AUTH_FILE = "./session/auth.json";

// Load session dari environment variable SESSION (jika ada)
if (process.env.SESSION && !fs.existsSync(AUTH_FILE)) {
  try {
    const sessionData = Buffer.from(process.env.SESSION, "base64").toString();
    if (!fs.existsSync("./session")) fs.mkdirSync("./session");
    fs.writeFileSync(AUTH_FILE, sessionData);
    console.log("✅ Session loaded from SESSION env");
  } catch (err) {
    console.error("❌ Gagal load session:", err);
  }
}

const store = makeInMemoryStore({ logger: P().child({ level: "silent" }) });

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
  const { state, saveCreds } = useSingleFileAuthState(AUTH_FILE);
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
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        startBot();
      }
    }

    if (connection === "open") {
      console.log("✅ BOT CONNECTED! Session exists and working");
      if (sock.user && sock.user.id) {
        botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        console.log("🤖 Bot number:", botNumber);
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

      try {
        await sock.readMessages([msg.key]);
      } catch (readErr) {}

      let command = body;
      if (command.startsWith('!')) command = command.slice(1);

      // ========== PING ==========
      if (command === "ping") {
        console.log("⚡ Menjalankan perintah ping, mengirim ke:", from);
        
        // 🟢🟢🟢 FIX: Trigger session dengan kirim ke diri sendiri 🟢🟢🟢
        if (botNumber) {
          try {
            await sock.sendMessage(botNumber, { text: "." });
            console.log("✅ Session trigger terkirim");
          } catch (e) {
            console.log("⚠️ Trigger session gagal, tapi lanjut");
          }
        }
        
        try {
          await sock.sendMessage(from, { text: "pong 🏓" });
          console.log("✅ Pesan pong terkirim ke", from);
        } catch (sendErr) {
          console.error("❌ Gagal mengirim pong:", sendErr);
        }
      }

      // ========== MENU ==========
      if (command === "menu") {
        try {
          await sock.sendMessage(from, {
            text: `🤖 *MENU BOT*\n\n• ping\n• menu\n• idgrup\n• tagall`
          });
        } catch (sendErr) {
          console.error("❌ Gagal kirim menu:", sendErr);
        }
      }

      // ========== ID GRUP ==========
      if (command === "idgrup") {
        if (!isGroup) {
          await sock.sendMessage(from, { text: "❌ Hanya di grup" });
          return;
        }
        try {
          await sock.sendMessage(from, { text: `📌 *ID Grup:*\n\`${from}\`` });
        } catch (sendErr) {
          console.error("❌ Gagal kirim idgrup:", sendErr);
        }
      }

      // ========== TAGALL ==========
      if (command === "tagall") {
        if (!isGroup) return;
        try {
          const group = await sock.groupMetadata(from);
          const members = group.participants.map(p => p.id);
          let teks = "📢 *TAG ALL*\n\n";
          for (let m of members) {
            teks += "@" + m.split("@")[0] + "\n";
          }
          await sock.sendMessage(from, { text: teks, mentions: members });
          console.log("✅ Tagall terkirim");
        } catch (err) {
          console.error("❌ Tagall error:", err);
        }
      }

    } catch (err) {
      console.error("❌ Handler error:", err);
    }
  });
}

startBot().catch(console.error);
