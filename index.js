const { default: makeWASocket, useSingleFileAuthState } = require("@whiskeysockets/baileys")
const { BufferJSON } = require("@whiskeysockets/baileys")
const fs = require("fs")

const SESSION = process.env.SESSION_ID

if (!fs.existsSync("./session.json")) {
    const buff = Buffer.from(SESSION, "base64")
    fs.writeFileSync("./session.json", buff.toString())
}

const { state, saveState } = useSingleFileAuthState("./session.json")

async function startBot() {

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveState)

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0]
        if (!msg.message) return

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text

        if (text === "ping") {
            await sock.sendMessage(msg.key.remoteJid, { text: "pong" })
        }

    })

}

startBot()
