global.crypto = require("crypto")

const {
default: makeWASocket,
useMultiFileAuthState,
fetchLatestBaileysVersion,
DisconnectReason,
makeInMemoryStore,
getContentType
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

// ===== PERBAIKAN: AMBIL TEXT DENGAN LEBIH LENGKAP =====
const type = getContentType(msg.message)
let text = ""

if (type === "conversation") {
text = msg.message.conversation
} else if (type === "extendedTextMessage") {
text = msg.message.extendedTextMessage.text
} else if (type === "imageMessage") {
text = msg.message.imageMessage.caption || ""
} else if (type === "videoMessage") {
text = msg.message.videoMessage.caption || ""
} else if (type === "documentMessage") {
text = msg.message.documentMessage.caption || ""
} else if (type === "buttonsResponseMessage") {
text = msg.message.buttonsResponseMessage.selectedDisplayText || ""
} else if (type === "listResponseMessage") {
text = msg.message.listResponseMessage.singleSelectReply?.selectedRowId || ""
}

// Cek apakah ada quoted message (pesan yang dibalas)
if (!text && msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
const quotedType = getContentType(msg.message.extendedTextMessage.contextInfo.quotedMessage)
if (quotedType === "conversation") {
text = msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation
}
}

if(!text) {
console.log("PESAN NON-TEKS (mungkin media/sticker)")
return
}

console.log("PESAN DARI:", from)
console.log("SENDER:", sender)
console.log("TEXT:", text)
console.log("TIPE:", type)

// read message
await sock.readMessages([msg.key])

// ===== COMMAND =====

// ping
if(text.toLowerCase() === "ping"){
await sock.sendMessage(from,{ text:"pong" })
}

// test
if(text.toLowerCase() === "test"){
await sock.sendMessage(from,{ text:"bot aktif" })
}

// menu
if(text.toLowerCase() === "menu"){
await sock.sendMessage(from,{
text:`🤖 MENU BOT

ping - Cek bot
menu - Tampilkan menu
test - Test bot
!idgrup - Lihat ID grup (khusus grup)
!say [pesan] - Bot akan mengulang pesan`
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

}

// Contoh command tambahan untuk test di grup
if(text.startsWith("!say ")){
const pesan = text.slice(5)
await sock.sendMessage(from, { text: `Kamu bilang: ${pesan}` })
}

}catch(err){
console.log("ERROR:",err)
}

})

}

startBot()
