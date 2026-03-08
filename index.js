global.crypto = require("crypto")

const {
default: makeWASocket,
useMultiFileAuthState,
fetchLatestBaileysVersion,
DisconnectReason
} = require("@whiskeysockets/baileys")

const P = require("pino")
const fs = require("fs")

async function startBot(){

// load session dari ENV
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
syncFullHistory:false,
markOnlineOnConnect:false,
browser:["Heroku Bot","Chrome","1.0"],
logger: P({ level: "silent" })
})

// connection
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

// message handler
sock.ev.on("messages.upsert", async ({ messages }) => {

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

if(text === "ping"){
await sock.sendMessage(from,{text:"pong"})
}

if(text === "menu"){
await sock.sendMessage(from,{text:"menu\nping\ntest"})
}

if(text === "test"){
await sock.sendMessage(from,{text:"bot aktif"})
}

})

}

startBot()
