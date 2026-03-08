const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const fs = require("fs")

async function start(){

if(process.env.SESSION && !fs.existsSync("./session/creds.json")){
const session = JSON.parse(Buffer.from(process.env.SESSION,"base64").toString())
fs.mkdirSync("./session",{recursive:true})
fs.writeFileSync("./session/creds.json",JSON.stringify(session,null,2))
}

const { state, saveCreds } = await useMultiFileAuthState("session")
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
version,
auth: state
})

sock.ev.on("creds.update", saveCreds)

sock.ev.on("messages.upsert", async ({ messages }) => {

const msg = messages[0]
if(!msg.message) return

const text =
msg.message.conversation ||
msg.message.extendedTextMessage?.text

if(text === "ping"){
await sock.sendMessage(msg.key.remoteJid,{text:"pong 🟢 bot aktif"})
}

})

}

start()
