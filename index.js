global.crypto = require("crypto")

const {
default: makeWASocket,
useMultiFileAuthState,
fetchLatestBaileysVersion,
DisconnectReason,
makeInMemoryStore
} = require("@whiskeysockets/baileys")

const P = require("pino")
const fs = require("fs")

// ===== KONFIGURASI =====
const OWNER = [
"6283133199990@s.whatsapp.net" // GANTI NOMOR KAMU
]

// store pesan
const store = makeInMemoryStore({
logger: P().child({ level: "silent", stream: "store" })
})

// fungsi ambil teks
function getMessageText(message) {
try {
if (!message?.message) return ""
const msg = message.message

if (msg.conversation) return msg.conversation
if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text
if (msg.imageMessage?.caption) return msg.imageMessage.caption
if (msg.videoMessage?.caption) return msg.videoMessage.caption
if (msg.documentMessage?.caption) return msg.documentMessage.caption

return ""
} catch {
return ""
}
}

// fungsi utama
async function startBot() {
try {
console.log("🚀 Starting Bot with Baileys 6.7.19...")

// LOAD SESSION DARI ENV (INI YANG PAKAI)
if (process.env.SESSION) {
try {
if (!fs.existsSync("./session")) {
fs.mkdirSync("./session", { recursive: true })
}
        
// Cek apakah session sudah ada
if (!fs.existsSync("./session/creds.json")) {
console.log("📦 Loading session from Heroku env...")
const session = JSON.parse(
Buffer.from(process.env.SESSION, "base64").toString()
)
fs.writeFileSync("./session/creds.json", JSON.stringify(session, null, 2))
console.log("✅ Session loaded successfully")
} else {
console.log("✅ Using existing session file")
}
} catch (e) {
console.log("❌ Gagal load session:", e.message)
}
} else {
console.log("⚠️ No SESSION env found, will use QR (if first run)")
}

const { state, saveCreds } = await useMultiFileAuthState("session")
const { version } = await fetchLatestBaileysVersion()
console.log("📦 Baileys version:", version)

const sock = makeWASocket({
version,
auth: state,
printQRInTerminal: true, // QR code sebagai text fallback
markOnlineOnConnect: true,
syncFullHistory: false,
browser: ["Heroku", "Chrome", "1.0"],
logger: P({ level: "error" }),
getMessage: (key) => ({ conversation: "..." })
})

store.bind(sock.ev)

// Handle koneksi
sock.ev.on("connection.update", (update) => {
const { connection, lastDisconnect, qr } = update

if (qr && !process.env.SESSION) {
// Hanya tampilkan QR kalau真的 belum punya session
console.log("\n" + "=".repeat(50))
console.log("📱 SCAN QR CODE:")
console.log("=".repeat(50))
console.log(qr)
console.log("=".repeat(50))
}

if (connection === "close") {
const shouldReconnect = 
lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

if (shouldReconnect) {
console.log("🔄 Connection closed, reconnecting in 5s...")
setTimeout(() => startBot(), 5000)
} else {
console.log("❌ Logged out, need new session")
}
}

if (connection === "open") {
console.log("\n" + "=".repeat(50))
console.log("✅ BOT CONNECTED!")
console.log("👤 Owner:", OWNER[0].split("@")[0])
console.log("⏰ Time:", new Date().toLocaleString())
console.log("=".repeat(50))
}
})

// save creds
sock.ev.on("creds.update", saveCreds)

// handle pesan
sock.ev.on("messages.upsert", async (m) => {
try {
const msg = m.messages[0]
if (!msg.message) return
if (msg.key.remoteJid === "status@broadcast") return

const from = msg.key.remoteJid
const sender = msg.key.participant || msg.key.remoteJid
const fromMe = msg.key.fromMe
const text = getMessageText(msg)

// log pesan
const jenis = from.endsWith("@g.us") ? "👥 GRUP" : "👤 CHAT"
const senderName = sender.split("@")[0]
const fromName = from.split("@")[0]
console.log(`${jenis} [${fromName}] ${senderName}: ${text || "(media)"}`)

if (fromMe || !text) return

await sock.readMessages([msg.key])

const cmd = text.toLowerCase().trim()

// COMMANDS
if (cmd === "ping") {
await sock.sendMessage(from, { text: "pong 🏓" })
console.log("✅ Reply: ping")
}

else if (cmd === "test") {
await sock.sendMessage(from, { text: "✅ Bot aktif! (Baileys 6.7.19)" })
console.log("✅ Reply: test")
}

else if (cmd === "menu") {
await sock.sendMessage(from, { 
text: `╔══════《 BOT 》══════╗

⚡ ping
⚡ test
⚡ menu
⚡ info
⚡ !owner
⚡ !idgrup
╚════════════════════╝` 
})
console.log("✅ Reply: menu")
}

else if (cmd === "info") {
await sock.sendMessage(from, { 
text: `📱 *INFO BOT*
├ Versi: 6.7.19
├ Owner: ${OWNER[0].split("@")[0]}
├ Status: Online
├ Runtime: ${Math.floor(process.uptime())}s
└ Platform: Heroku` 
})
}

else if (cmd === "!owner") {
await sock.sendMessage(from, { 
text: `👑 Owner: ${OWNER[0].split("@")[0]}\n\nHubungi hanya untuk hal penting.` 
})
}

else if (text.startsWith("!idgrup")) {
if (!from.endsWith("@g.us")) {
await sock.sendMessage(from, { text: "❌ Command hanya untuk di grup" })
return
}
if (!OWNER.includes(sender)) {
await sock.sendMessage(from, { text: "❌ Hanya owner" })
return
}
await sock.sendMessage(from, { text: `📌 ID Grup ini:\n\`${from}\`` })
console.log("✅ Reply: idgrup")
}

} catch (err) {
console.log("❌ Error handling message:", err.message)
}
})

} catch (err) {
console.log("❌ Fatal error:", err.message)
setTimeout(() => startBot(), 5000)
}
}

// error handler
process.on("uncaughtException", (err) => {
console.log("⚠️ Uncaught Exception:", err.message)
})

process.on("unhandledRejection", (err) => {
console.log("⚠️ Unhandled Rejection:", err.message)
})

// start
console.log("🎯 Initializing WhatsApp Bot...")
startBot()
