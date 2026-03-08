const {
default: makeWASocket,
useMultiFileAuthState,
fetchLatestBaileysVersion,
DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs")

async function startBot(){

// convert SESSION env ke creds.json
if(process.env.SESSION && !fs.existsSync("./session/creds.json")){
const session = JSON.parse(
Buffer.from(process.env.SESSION,"base64").toString()
)

fs.mkdirSync("./session",{recursive:true})
fs.writeFileSync("./session/creds.json",JSON.stringify(session,null,2))
}

const { state, saveCreds } = await useMultiFileAuthState("session")
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
version,
auth: state,
syncFullHistory: false,
browser: ["Heroku Bot","Chrome","1.0"]
})

// auto reconnect
sock.ev.on("connection.update",(update)=>{
const { connection, lastDisconnect } = update

if(connection === "close"){

const shouldReconnect =
lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

if(shouldReconnect){
console.log("reconnecting...")
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

const msg = messages[0]
if(!msg.message) return

const from = msg.key.remoteJid

const text =
msg.message.conversation ||
msg.message.extendedTextMessage?.text

if(!text) return

// command ping
if(text === "ping"){

await sock.sendMessage(from,{
text:"pong 🟢 bot aktif"
})

}

// command test
if(text === "menu"){

await sock.sendMessage(from,{
text:`BOT HEROKU AKTIF

menu
ping
test`
})

}

})

}

startBot()
