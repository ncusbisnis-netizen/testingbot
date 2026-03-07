const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys")

async function startBot() {

const { state, saveCreds } = await useMultiFileAuthState("session")

const sock = makeWASocket({
auth: state
})

sock.ev.on("creds.update", saveCreds)

sock.ev.on("connection.update", async ({ connection }) => {

if (connection === "open") {
console.log("BOT CONNECTED")
}

})

sock.ev.on("messages.upsert", async ({ messages }) => {

const msg = messages[0]

if (!msg.message) return

const text = msg.message.conversation || ""

if (text === "ping") {

await sock.sendMessage(msg.key.remoteJid,{ text: "pong 🚀 bot aktif" })

}

})

}

startBot()
