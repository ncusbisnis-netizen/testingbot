global.crypto = require("crypto")
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const fs = require("fs")
const P = require("pino")

const OWNER = ["6283133199990@s.whatsapp.net"]

async function startBot() {
    try {
        console.log("STARTING BOT...")
        
        // Load session
        if (process.env.SESSION) {
            if (!fs.existsSync("./session")) fs.mkdirSync("./session")
            if (!fs.existsSync("./session/creds.json")) {
                const session = JSON.parse(Buffer.from(process.env.SESSION, "base64"))
                fs.writeFileSync("./session/creds.json", JSON.stringify(session))
                console.log("✓ SESSION LOADED")
            }
        }

        const { state, saveCreds } = await useMultiFileAuthState("./session")
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ["Heroku", "Chrome", "1.0"],
            logger: P({ level: "fatal" }),
            markOnlineOnConnect: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            defaultQueryTimeoutMs: 60000
        })

        sock.ev.on("creds.update", saveCreds)

        sock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect } = update
            
            if (connection === "open") {
                console.log("✓ BOT CONNECTED!")
                console.log(`✓ OWNER: ${OWNER[0]}`)
            }
            
            if (connection === "close") {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                console.log("✗ CONNECTION CLOSED, RECONNECTING...")
                if (shouldReconnect) {
                    setTimeout(startBot, 5000)
                }
            }
        })

        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                if (!msg.message) return
                
                const from = msg.key.remoteJid
                if (from === "status@broadcast") return
                
                const text = msg.message.conversation || 
                            msg.message.extendedTextMessage?.text || 
                            msg.message.imageMessage?.caption || ""
                
                if (!text) return
                
                console.log(`PESAN: ${text} | DARI: ${from}`)
                
                // Command sederhana
                if (text.toLowerCase() === "ping") {
                    await sock.sendMessage(from, { text: "pong!" })
                    console.log("RESPON: pong")
                }
                
                if (text.toLowerCase() === "test") {
                    await sock.sendMessage(from, { text: "bot aktif!" })
                }
                
            } catch (e) {
                console.log("ERROR PESAN:", e.message)
            }
        })
        
    } catch (e) {
        console.log("ERROR BOT:", e.message)
        setTimeout(startBot, 5000)
    }
}

startBot()
