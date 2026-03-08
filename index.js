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
const qrcode = require("qrcode-terminal")

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
console.log("🚀 Starting Bot...")

// load session dari env
if (process.env.SESSION && !fs.existsSync("./session/creds.json")) {
try {
const session = JSON.parse(
Buffer.from(process.env.SESSION, "base64").toString()
)
fs.mkdirSync("./session", { recursive: true })
fs.writeFileSync("./session/creds.json", JSON.stringify(session, null, 2))
console.log("✅ Session loaded from env")
} catch (e) {
console.log("❌ Failed load session:", e.message)
}
}

const { state, saveCreds } = await useMultiFileAuthState("session")
const { version } = await fetchLatestBaileysVersion()
console.log("📦 Baileys version:", version)

const sock = makeWASocket({
version,
auth: state,
printQRInTerminal: false,
markOnlineOnConnect: true,
syncFullHistory: false,
browser: ["Ubuntu", "Chrome", "20.0.0"],
logger: P({ level: "error" }),
getMessage: (key) => ({ conversation: "..." })
})

store.bind(sock.ev)

// QR Code
sock.ev.on("connection.update", (update) => {
const { connection, lastDisconnect, qr } = update

if (qr) {
qrcode.generate(qr, { small: true })
console.log("📱 Scan QR di atas dengan WhatsApp")
}

if (connection === "close") {
const shouldReconnect = 
lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

if (shouldReconnect) {
console.log("🔄 Reconnecting in 5s...")
setTimeout(() => startBot(), 5000)
}
}

if (connection === "open") {
console.log("✅ BOT CONNECTED!")
console.log("👤 Owner:", OWNER[0])
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

// log
console.log(`📨 [${from.split("@")[0]}] ${sender.split("@")[0]}: ${text || "(media)"}`)

if (fromMe || !text) return

await sock.readMessages([msg.key])

const cmd = text.toLowerCase().trim()

// commands
if (cmd === "ping") {
await sock.sendMessage(from, { text: "pong 🏓" })
console.log("✅ ping replied")
}

else if (cmd === "test") {
await sock.sendMessage(from, { text: "✅ bot aktif" })
console.log("✅ test replied")
}

else if (cmd === "menu") {
await sock.sendMessage(from, { 
text: `╔══《 BOT MENU 》══╗

⚡ ping
⚡ test
⚡ menu
⚡ info
⚡ !owner
⚡ !idgrup
╚════════════════╝` 
})
console.log("✅ menu replied")
}

else if (cmd === "info") {
await sock.sendMessage(from, { 
text: `📱 INFO BOT
├ Versi: 6.7.19
├ Owner: ${OWNER[0].split("@")[0]}
├ Status: Online
└ Runtime: ${process.uptime().toFixed(0)}s` 
})
}

else if (cmd === "!owner") {
await sock.sendMessage(from, { 
text: `👑 Owner: ${OWNER[0].split("@")[0]}` 
})
}

else if (text.startsWith("!idgrup")) {
if (!from.endsWith("@g.us")) {
await sock.sendMessage(from, { text: "❌ hanya di grup" })
return
}
if (!OWNER.includes(sender)) {
await sock.sendMessage(from, { text: "❌ hanya owner" })
return
}
await sock.sendMessage(from, { text: `📌 ID Grup:\n${from}` })
console.log("✅ idgrup replied")
}

} catch (err) {
console.log("❌ Error:", err.message)
}
})

} catch (err) {
console.log("❌ Fatal:", err.message)
setTimeout(() => startBot(), 5000)
}
}

// error handler
process.on("uncaughtException", (err) => console.log("⚠️", err.message))
process.on("unhandledRejection", (err) => console.log("⚠️", err.message))

// start
startBot()
