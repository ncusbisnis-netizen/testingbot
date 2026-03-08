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

// ADMIN BOT
const OWNER = ["6281234567890@s.whatsapp.net"] // ganti nomor kamu

const store = makeInMemoryStore({
logger: P().child({ level: "silent", stream: "store" })
})

async function startBot(){

// LOAD SESSION
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
logger: P({ level:"silent" })
})

store.bind(sock.ev)

// CONNECTION
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

// SAVE SESSION
sock.ev.on("creds.update", saveCreds)

// MESSAGE HANDLER
sock.ev.on("messages.upsert", async ({ messages }) => {

try{

const msg = messages[0]

if(!msg.message) return
if(msg.key.fromMe) return
if(msg.key.remoteJid === "status@broadcast") return

const from = msg.key.remoteJid
const sender = msg.key.participant || msg.key.remoteJid

// READ MESSAGE (biar langsung centang 2)
await sock.readMessages([msg.key])

const text =
msg.message.conversation ||
msg.message.extendedTextMessage?.text ||
""

if(!text) return

// PING
if(text === "ping"){
await sock.sendMessage(from,{text:"pong"})
}

// MENU
if(text === "menu"){
await sock.sendMessage(from,{
text:`MENU BOT

ping
menu
test
!idgrup`
})
}

// TEST
if(text === "test"){
await sock.sendMessage(from,{text:"bot aktif"})
}

// ID GRUP
if(text === "!idgrup"){

if(!from.endsWith("@g.us")){
return sock.sendMessage(from,{
text:"❌ Command hanya bisa dipakai di grup"
})
}

if(!OWNER.includes(sender)){
return sock.sendMessage(from,{
text:"❌ Hanya admin bot yang bisa memakai command ini"
})
}

await sock.sendMessage(from,{
text:`ID Grup:\n${from}`
})

}

}catch(e){
console.log("ERROR:",e)
}

})

}

startBot()
