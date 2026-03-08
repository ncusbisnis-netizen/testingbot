global.crypto = require("crypto")

const {
default: makeWASocket,
useMultiFileAuthState,
fetchLatestBaileysVersion,
DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs")

async function startBot(){

// ambil SESSION dari Heroku
if(process.env.SESSION && !fs.existsSync("./session/creds.json")){

const session = JSON.parse(
Buffer.from(process.env.SESSION,"base64").toString()
)

fs.mkdirSync("./session",{recursive:true})
fs.writeFileSync("./session/creds.json",JSON.stringify(session,null,2))

console.log("SESSION loaded")
}

const { state, saveCreds } = await useMultiFileAuthState("session")
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
version,
auth: state,
syncFullHistory:false,
markOnlineOnConnect:false,
browser:["Heroku Bot","Chrome","1.0"]
})

// connection update
sock.ev.on("connection.update",(update)=>{

const { connection, lastDisconnect } = update

if(connection === "close"){

const shouldReconnect =
lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

console.log("Connection closed")

if(shouldReconnect){
console.log("Reconnecting...")
startBot()
}

}

if(connection === "open"){
console.log("BOT CONNECTED ✅")
}

})

// save session
sock.ev.on("creds.update", saveCreds)

// message handler
sock.ev.on("messages.upsert", async ({ messages }) => {

try{

const msg = messages[0]

if(!msg.message) return
if(msg.key.fromMe) return
if(msg.key.remoteJid === "status@broadcast") return
if(msg.key.remoteJid.endsWith("@g.us")) return

const from = msg.key.remoteJid

const text =
msg.message.conversation ||
msg.message.extendedTextMessage?.text ||
""

if(!text) return

console.log("Message:",text)

// COMMAND

if(text === "ping"){

await sock.sendMessage(from,{
text:"pong 🟢 bot aktif"
})

}

if(text === "menu"){

await sock.sendMessage(from,{
text:`🤖 BOT HEROKU AKTIF

menu
ping
test`
})

}

if(text === "test"){

await sock.sendMessage(from,{
text:"bot berjalan normal ✅"
})

}

}catch(err){
console.log("ERROR:",err)
}

})

}

startBot()
