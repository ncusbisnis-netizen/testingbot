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

// ===== ADMIN BOT =====
const OWNER = [
"6281234567890@s.whatsapp.net" // ganti nomor kamu
]

// store message
const store = makeInMemoryStore({
logger: P().child({ level: "silent", stream: "store" })
})

// Fungsi untuk mengekstrak teks dari berbagai tipe pesan
function getMessageText(message) {
try {
if (!message) return ""
    
// Cek berbagai kemungkinan tipe pesan
const msg = message.message
    
if (!msg) return ""

// Pesan teks biasa
if (msg.conversation) {
return msg.conversation
}
    
// Extended text message (termasuk yang reply)
if (msg.extendedTextMessage?.text) {
return msg.extendedTextMessage.text
}
    
// Caption untuk media
if (msg.imageMessage?.caption) {
return msg.imageMessage.caption
}
    
if (msg.videoMessage?.caption) {
return msg.videoMessage.caption
}
    
if (msg.documentMessage?.caption) {
return msg.documentMessage.caption
}
    
if (msg.audioMessage?.caption) {
return msg.audioMessage.caption
}
    
// Button response
if (msg.buttonsResponseMessage?.selectedDisplayText) {
return msg.buttonsResponseMessage.selectedDisplayText
}
    
if (msg.buttonsResponseMessage?.selectedButtonId) {
return msg.buttonsResponseMessage.selectedButtonId
}
    
// List response
if (msg.listResponseMessage?.title) {
return msg.listResponseMessage.title
}
    
if (msg.listResponseMessage?.description) {
return msg.listResponseMessage.description
}
    
// Template button reply
if (msg.templateButtonReplyMessage?.selectedId) {
return msg.templateButtonReplyMessage.selectedId
}
    
if (msg.templateButtonReplyMessage?.selectedDisplayText) {
return msg.templateButtonReplyMessage.selectedDisplayText
}
    
// Interactive response
if (msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJSON) {
try {
const params = JSON.parse(msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJSON)
return params.screen_0?.selected_option || JSON.stringify(params)
} catch {
return ""
}
}
    
// Jika ada pesan yang di-quote (context info)
if (msg.extendedTextMessage?.contextInfo?.quotedMessage) {
const quotedMsg = msg.extendedTextMessage.contextInfo.quotedMessage
    
// Rekursif cek pesan yang di-quote
if (quotedMsg.conversation) {
return `[Membalas] ${quotedMsg.conversation}`
}
    
if (quotedMsg.extendedTextMessage?.text) {
return `[Membalas] ${quotedMsg.extendedTextMessage.text}`
}
}

return ""
} catch (error) {
console.log("Error extracting text:", error)
return ""
}
}

async function startBot(){

// ===== LOAD SESSION =====
if(process.env.SESSION && !fs.existsSync("./session/creds.json")){
const session = JSON.parse(
Buffer.from(process.env.SESSION,"base64").toString()
)
fs.mkdirSync("./session",{recursive:true})
fs.writeFileSync("./session/creds.json",JSON.stringify(session,null,2))
console.log("SESSION LOADED")
}

const { state, saveCreds } = await useMultiFileAuthState("session")
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
version,
auth: state,
printQRInTerminal:false,
markOnlineOnConnect:true,
syncFullHistory:false,
browser:["Heroku Bot","Chrome","1.0"],
logger:P({level:"silent"})
})

store.bind(sock.ev)

// ===== CONNECTION =====
sock.ev.on("connection.update",(update)=>{
const { connection, lastDisconnect } = update

if(connection === "close"){
const shouldReconnect =
lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
if(shouldReconnect){
console.log("RECONNECTING")
startBot()
}
}

if(connection === "open"){
console.log("BOT CONNECTED")
}
})

// save session
sock.ev.on("creds.update", saveCreds)

// ===== MESSAGE EVENT =====
sock.ev.on("messages.upsert", async (m)=>{

try{
const msg = m.messages[0]

if(!msg.message) return
if(msg.key.remoteJid === "status@broadcast") return

const from = msg.key.remoteJid
const sender = msg.key.participant || msg.key.remoteJid
const fromMe = msg.key.fromMe

// AMBIL TEXT MENGGUNAKAN FUNGSI BARU
const text = getMessageText(msg)

// Log lengkap untuk debugging
console.log("===== DETAIL PESAN =====")
console.log("FROM:", from)
console.log("SENDER:", sender)
console.log("TEXT:", text || "(KOSONG)")
console.log("TIPE PESAN:", Object.keys(msg.message)[0])
console.log("DARI BOT:", fromMe)
console.log("=======================")

// Skip jika tidak ada teks (tapi tetap log untuk debugging)
if(!text) {
console.log("PESAN NON-TEKS (dilewati)")
return
}

// read message
await sock.readMessages([msg.key])

// ===== COMMAND (case insensitive) =====
const cmd = text.toLowerCase().trim()

// ping
if(cmd === "ping"){
await sock.sendMessage(from,{ text:"pong" })
console.log("RESPON: pong dikirim ke", from)
}

// test
if(cmd === "test"){
await sock.sendMessage(from,{ text:"bot aktif" })
console.log("RESPON: bot aktif dikirim ke", from)
}

// menu
if(cmd === "menu"){
await sock.sendMessage(from,{
text:`🤖 MENU BOT

ping - Cek bot
menu - Tampilkan menu
test - Test bot
!idgrup - Lihat ID grup (khusus grup)
!halo - Sapaan`
})
console.log("RESPON: menu dikirim ke", from)
}

// halo
if(cmd === "!halo"){
await sock.sendMessage(from,{
text:`Halo juga! 👋\nKamu: ${sender.split("@")[0]}`
})
}

// ===== ID GRUP =====
if(text.startsWith("!idgrup")){

// harus di grup
if(!from.endsWith("@g.us")){
return sock.sendMessage(from,{
text:"❌ Command hanya bisa di grup"
})
}

// hanya owner atau bot
if(!OWNER.includes(sender) && !fromMe){
return sock.sendMessage(from,{
text:"❌ Hanya admin bot"
})
}

await sock.sendMessage(from,{
text:`ID Grup:\n${from}`
})
console.log("RESPON: ID grup dikirim ke", from)
}

}catch(err){
console.log("ERROR DETAIL:", err)
}
})

}

startBot()
