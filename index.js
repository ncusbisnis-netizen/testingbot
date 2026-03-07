const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys")

async function startBot() {

const { state, saveCreds } = await useMultiFileAuthState("session")

const sock = makeWASocket({
auth: state,
printQRInTerminal: true
})

sock.ev.on("creds.update", saveCreds)

sock.ev.on("messages.upsert", async ({ messages }) => {

const msg = messages[0]
if (!msg.message) return

const sender = msg.key.remoteJid
const text =
msg.message.conversation ||
msg.message.extendedTextMessage?.text

if (!text) return

if (text === "ping") {
await sock.sendMessage(sender, { text: "pong" })
}

})

}

startBot()
