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

// ===== OWNER =====
const OWNER = ["6281234567890@s.whatsapp.net"] // ganti nomor kamu

const store = makeInMemoryStore({
logger: P().child({ level: "silent", stream: "store" })
})

const startTime = new Date()

async function startBot(){

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
browser:["PremiumBot","Chrome","1.0"],
markOnlineOnConnect:true,
logger:P({level:"silent"})
})

store.bind(sock.ev)

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

sock.ev.on("creds.update", saveCreds)

sock.ev.on("messages.upsert", async ({ messages })=>{

try{

const msg = messages[0]
if(!msg.message) return
if(msg.key.remoteJid === "status@broadcast") return

const from = msg.key.remoteJid
const sender = msg.key.participant || msg.key.remoteJid
const isGroup = from.endsWith("@g.us")

let text = ""

if(msg.message.conversation){
text = msg.message.conversation
}

else if(msg.message.extendedTextMessage){
text = msg.message.extendedTextMessage.text
}

else if(msg.message.ephemeralMessage){
text = msg.message.ephemeralMessage.message?.extendedTextMessage?.text || ""
}

text = text.toLowerCase()

await sock.readMessages([msg.key])

// ===== MENU =====

if(text === "menu"){

await sock.sendMessage(from,{
text:`🤖 *PREMIUM BOT MENU*

ping
runtime
!idgrup
!tagall
!hidetag
!kick
!add
!promote
!demote`
})

}

// ===== PING =====

if(text === "ping"){
await sock.sendMessage(from,{ text:"pong 🏓" })
}

// ===== RUNTIME =====

if(text === "runtime"){

const uptime = process.uptime()

await sock.sendMessage(from,{
text:`⏱ Runtime : ${Math.floor(uptime)} seconds`
})

}

// ===== ID GRUP =====

if(text === "!idgrup"){

if(!isGroup){
return sock.sendMessage(from,{text:"❌ hanya di grup"})
}

await sock.sendMessage(from,{
text:`ID Grup:\n${from}`
})

}

// ===== TAG ALL =====

if(text === "!tagall"){

if(!isGroup) return

const group = await sock.groupMetadata(from)

let members = group.participants.map(p=>p.id)

let teks = "📢 TAG ALL\n\n"

for(let m of members){
teks += "@"+m.split("@")[0]+"\n"
}

await sock.sendMessage(from,{
text:teks,
mentions:members
})

}

// ===== HIDETAG =====

if(text === "!hidetag"){

if(!isGroup) return

const group = await sock.groupMetadata(from)

let members = group.participants.map(p=>p.id)

await sock.sendMessage(from,{
text:"📢 Pesan dari admin",
mentions:members
})

}

// ===== KICK =====

if(text.startsWith("!kick")){

if(!isGroup) return

const group = await sock.groupMetadata(from)

const isAdmin = group.participants.find(
p=>p.id === sender && p.admin
)

if(!isAdmin) return

const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid

if(!mentioned) return

await sock.groupParticipantsUpdate(from, mentioned, "remove")

}

// ===== ADD =====

if(text.startsWith("!add")){

if(!isGroup) return

const number = text.split(" ")[1]

if(!number) return

await sock.groupParticipantsUpdate(
from,
[number+"@s.whatsapp.net"],
"add"
)

}

// ===== PROMOTE =====

if(text === "!promote"){

if(!isGroup) return

const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid

if(!mentioned) return

await sock.groupParticipantsUpdate(from, mentioned, "promote")

}

// ===== DEMOTE =====

if(text === "!demote"){

if(!isGroup) return

const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid

if(!mentioned) return

await sock.groupParticipantsUpdate(from, mentioned, "demote")

}

}catch(err){

console.log(err)

}

})

}

startBot()
