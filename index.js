const { default: makeWASocket, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")

async function startBot(){

const session = JSON.parse(Buffer.from(process.env.SESSION,"base64").toString())

const { state, saveCreds } = await require("@whiskeysockets/baileys").useMultiFileAuthState('./session')

Object.assign(state.creds, session)

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

await sock.sendMessage(msg.key.remoteJid,{
text:"pong 🟢 bot aktif"
})

}

})

}

startBot()
