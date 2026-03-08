global.crypto = require("crypto")
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const fs = require("fs")
const http = require('http')
const P = require("pino")

// ===== KONFIGURASI =====
const OWNER = ["6283133199990@s.whatsapp.net"] // GANTI NOMOR LO!

// ===== WEB SERVER PALSU (Biar Heroku gak matiin bot) =====
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.write('🤖 WhatsApp Bot Running\n')
    res.write(`Owner: ${OWNER[0].split('@')[0]}\n`)
    res.write(`Time: ${new Date().toLocaleString()}\n`)
    res.end()
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`)
})

// ===== FUNGSI UTAMA BOT =====
async function startBot() {
    try {
        console.log("\n" + "=".repeat(50))
        console.log("🚀 STARTING WHATSAPP BOT...")
        console.log("=".repeat(50))

        // ===== LOAD SESSION DARI HEROKU =====
        if (process.env.SESSION) {
            console.log("📦 SESSION environment found")
            
            // Buat folder session kalo belum ada
            if (!fs.existsSync("./session")) {
                fs.mkdirSync("./session", { recursive: true })
                console.log("📁 Created session folder")
            }
            
            // Load session kalo file creds belum ada
            if (!fs.existsSync("./session/creds.json")) {
                try {
                    console.log("📥 Loading session from environment...")
                    const sessionBase64 = process.env.SESSION
                    const sessionJson = Buffer.from(sessionBase64, "base64").toString()
                    const session = JSON.parse(sessionJson)
                    
                    fs.writeFileSync("./session/creds.json", JSON.stringify(session, null, 2))
                    console.log("✅ SESSION LOADED SUCCESSFULLY!")
                } catch (e) {
                    console.log("❌ Failed to load session:", e.message)
                }
            } else {
                console.log("✅ Using existing session file")
            }
        } else {
            console.log("⚠️ NO SESSION FOUND! Will use QR code")
        }

        // ===== INIT BAILEYS =====
        console.log("🔄 Initializing Baileys...")
        const { state, saveCreds } = await useMultiFileAuthState("./session")
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true, // QR code will show in logs
            browser: ["Heroku", "Chrome", "1.0"],
            logger: P({ level: "fatal" }), // Minimal logging
            markOnlineOnConnect: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            defaultQueryTimeoutMs: 60000
        })

        console.log("📱 Baileys initialized")

        // ===== SAVE CREDENTIALS =====
        sock.ev.on("creds.update", saveCreds)

        // ===== HANDLE CONNECTION =====
        sock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect, qr } = update
            
            // Tampilkan QR code kalo ada
            if (qr) {
                console.log("\n" + "📱".repeat(15))
                console.log("SCAN QR CODE DI BAWAH INI:")
                console.log("📱".repeat(15))
                console.log(qr)
                console.log("📱".repeat(15))
                console.log("⏰ QR expired in 60 seconds\n")
            }
            
            // Koneksi terbuka
            if (connection === "open") {
                console.log("\n" + "=".repeat(50))
                console.log("✅✅✅ BOT CONNECTED! ✅✅✅")
                console.log("=".repeat(50))
                console.log(`👤 Owner: ${OWNER[0].split('@')[0]}`)
                console.log(`⏰ Time: ${new Date().toLocaleString()}`)
                console.log(`🌐 Web: http://localhost:${PORT}`)
                console.log("=".repeat(50) + "\n")
            }
            
            // Koneksi tertutup
            if (connection === "close") {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                
                console.log("\n❌ CONNECTION CLOSED")
                
                if (shouldReconnect) {
                    console.log("🔄 Reconnecting in 10 seconds...\n")
                    setTimeout(startBot, 10000)
                } else {
                    console.log("🚫 Logged out. Delete session and redeploy.\n")
                }
            }
        })

        // ===== HANDLE INCOMING MESSAGES =====
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0]
                
                // Skip kalo gak ada message
                if (!msg.message) return
                
                // Skip status broadcast
                if (msg.key.remoteJid === "status@broadcast") return
                
                // Ambil data pesan
                const from = msg.key.remoteJid
                const sender = msg.key.participant || msg.key.remoteJid
                const fromMe = msg.key.fromMe
                
                // Ambil teks dari berbagai tipe pesan
                let text = ""
                if (msg.message.conversation) {
                    text = msg.message.conversation
                } else if (msg.message.extendedTextMessage?.text) {
                    text = msg.message.extendedTextMessage.text
                } else if (msg.message.imageMessage?.caption) {
                    text = msg.message.imageMessage.caption
                } else if (msg.message.videoMessage?.caption) {
                    text = msg.message.videoMessage.caption
                }
                
                // Skip kalo gak ada teks
                if (!text) return
                
                // Skip pesan dari bot sendiri
                if (fromMe) return
                
                // Log pesan masuk
                const chatType = from.endsWith("@g.us") ? "👥 GROUP" : "👤 PRIVATE"
                console.log(`\n📨 ${chatType}`)
                console.log(`   From: ${from.split('@')[0]}`)
                console.log(`   Sender: ${sender.split('@')[0]}`)
                console.log(`   Message: ${text}`)
                
                // Tandai sudah dibaca
                await sock.readMessages([msg.key])
                
                // ===== PROSES COMMAND =====
                const cmd = text.toLowerCase().trim()
                
                // Command: ping
                if (cmd === "ping") {
                    await sock.sendMessage(from, { text: "🏓 Pong!" })
                    console.log(`   ✅ Replied: pong`)
                }
                
                // Command: test
                else if (cmd === "test") {
                    await sock.sendMessage(from, { text: "✅ Bot is active!" })
                    console.log(`   ✅ Replied: test`)
                }
                
                // Command: menu
                else if (cmd === "menu" || cmd === "help") {
                    const menuText = `╔══════《 BOT MENU 》══════╗

┏━━ ❯ *COMMANDS* ❮━━
┣ ⚡ ping
┣ ⚡ test
┣ ⚡ menu / help
┣ ⚡ info
┣ ⚡ !owner
┣ ⚡ !idgrup
┗━━━━━━━━━━━━━━━━

╚══════════════════════╝`
                    
                    await sock.sendMessage(from, { text: menuText })
                    console.log(`   ✅ Replied: menu`)
                }
                
                // Command: info
                else if (cmd === "info") {
                    const infoText = `📱 *BOT INFORMATION*

🤖 Name: WhatsApp Bot
⚡ Status: Online
👑 Owner: ${OWNER[0].split('@')[0]}
📦 Library: Baileys 6.7.19
⏰ Uptime: ${Math.floor(process.uptime())} seconds
🌐 Platform: Heroku`
                    
                    await sock.sendMessage(from, { text: infoText })
                    console.log(`   ✅ Replied: info`)
                }
                
                // Command: !owner
                else if (cmd === "!owner") {
                    await sock.sendMessage(from, { 
                        text: `👑 *OWNER BOT*\n\nNomor: ${OWNER[0].split('@')[0]}\n\nHubungi hanya untuk hal penting.` 
                    })
                    console.log(`   ✅ Replied: owner`)
                }
                
                // Command: !idgrup
                else if (text.startsWith("!idgrup")) {
                    // Cek apakah di grup
                    if (!from.endsWith("@g.us")) {
                        await sock.sendMessage(from, { 
                            text: "❌ Command ini hanya bisa digunakan di dalam grup!" 
                        })
                        console.log(`   ❌ Rejected: not in group`)
                        return
                    }
                    
                    // Cek apakah owner
                    if (!OWNER.includes(sender)) {
                        await sock.sendMessage(from, { 
                            text: "❌ Hanya owner yang bisa menggunakan command ini!" 
                        })
                        console.log(`   ❌ Rejected: not owner`)
                        return
                    }
                    
                    await sock.sendMessage(from, { 
                        text: `📌 *ID GRUP INI*\n\n\`\`\`${from}\`\`\`` 
                    })
                    console.log(`   ✅ Replied: group id`)
                }
                
            } catch (err) {
                console.log(`❌ Error processing message: ${err.message}`)
            }
        })

    } catch (err) {
        console.log("\n❌❌❌ FATAL ERROR ❌❌❌")
        console.log(err.message)
        console.log("🔄 Restarting in 10 seconds...\n")
        setTimeout(startBot, 10000)
    }
}

// ===== ERROR HANDLER GLOBAL =====
process.on("uncaughtException", (err) => {
    console.log("\n⚠️ UNCAUGHT EXCEPTION:")
    console.log(err.message)
    console.log("🔄 Bot will continue running...\n")
})

process.on("unhandledRejection", (err) => {
    console.log("\n⚠️ UNHANDLED REJECTION:")
    console.log(err.message)
    console.log("🔄 Bot will continue running...\n")
})

// ===== START THE BOT =====
console.log("\n" + "=".repeat(50))
console.log("🎯 INITIALIZING WHATSAPP BOT")
console.log("=".repeat(50) + "\n")

startBot()
