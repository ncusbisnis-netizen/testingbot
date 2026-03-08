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

// ===== OWNER BOT =====
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
console.log("RECONNECTING...")
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

console.log("EVENT PESAN MASUK")

const msg = m.messages[0]

if(!msg.message) return
if(msg.key.remoteJid === "status@broadcast") return

const from = msg.key.remoteJid
const sender = msg.key.participant || msg.key.remoteJid
const fromMe = msg.key.fromMe

// ambil text
const text =
msg.message.conversation ||
msg.message.extendedTextMessage?.text ||
msg.message.imageMessage?.caption ||
""

if(!text) return

console.log("PESAN:", text)

// read message
await sock.readMessages([msg.key])

// ===== COMMAND =====

// ping
if(text === "ping"){
await sock.sendMessage(from,{ text:"pong" })
}

// test
if(text === "test"){
await sock.sendMessage(from,{ text:"bot aktif" })
}

// menu
if(text === "menu"){
await sock.sendMessage(from,{
text:`🤖 MENU BOT

ping
menu
test
!idgrup`
})
}

// ===== ID GRUP =====
if(text.startsWith("!idgrup")){

if(!from.endsWith("@g.us")){
return sock.sendMessage(from,{
text:"❌ Command hanya bisa di grup"
})
}

// hanya owner atau bot sendiri
if(!OWNER.includes(sender) && !fromMe){
return sock.sendMessage(from,{
text:"❌ Hanya admin bot"
})
}

await sock.sendMessage(from,{
text:`ID Grup:\n${from}`
})

}

}catch(err){
console.log("ERROR:",err)
}

})

}

startBot()
