global.crypto = require("crypto")
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const fs = require("fs")

const OWNER = ["6283133199990@s.whatsapp.net"] // GANTI NOMOR LO

async function startBot() {
    try {
        // LOAD SESSION
        if (process.env.SESSION) {
            if (!fs.existsSync("./session")) fs.mkdirSync("./session")
            if (!fs.existsSync("./session/creds.json")) {
                const session = JSON.parse(Buffer.from(process.env.SESSION, "base64"))
                fs.writeFileSync("./session/creds.json", JSON.stringify(session))
                console.log("SESSION OK")
            }
        }

        const { state, saveCreds } = await useMultiFileAuthState("./session")
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ["Heroku", "Chrome", "1.0"]
        })

        // SIMPAN SESSION
        sock.ev.on("creds.update", saveCreds)

        // KONEKSI
        sock.ev.on("connection.update", (update) => {
            const { connection } = update
            if (connection === "open") console.log("BOT NYALA")
            if (connection === "close") setTimeout(startBot, 3000)
        })

        // TERIMA PESAN
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                if (!msg.message) return
                
                const from = msg.key.remoteJid
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
                
                if (!text) return
                
                console.log("PESAN:", text, "DARI:", from)
                
                if (text === "ping") {
                    await sock.sendMessage(from, { text: "pong" })
                    console.log("RESPON PONG")
                }
                
                if (text === "test") {
                    await sock.sendMessage(from, { text: "OK" })
                }
                
                if (text === "menu") {
                    await sock.sendMessage(from, { text: "PING\nTEST\nMENU" })
                }
                
            } catch (e) {
                console.log("ERROR:", e.message)
            }
        })
        
    } catch (e) {
        console.log("ERROR BOT:", e.message)
        setTimeout(startBot, 5000)
    }
}

startBot()
