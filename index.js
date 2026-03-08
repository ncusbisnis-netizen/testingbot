// index.js
import makeWASocket, { fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys'
import { readFileSync, writeFileSync } from 'fs'

const SESSION_FILE = './session.json'

// Load session
let session = {}
try {
    const data = readFileSync(SESSION_FILE, 'utf-8')
    session = JSON.parse(data)
    console.log('[INFO] Session loaded from file.')
} catch (err) {
    console.log('[INFO] No session found, starting fresh.')
}

// Start socket
async function startSock() {
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: session
    })

    // Save session on update
    sock.ev.on('creds.update', (creds) => {
        session = { ...session, ...creds }
        writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2))
        console.log('[INFO] Session updated.')
    })

    // Connection events
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode
            console.log('[WARN] Connection closed, reason:', reason)
            if (reason !== DisconnectReason.loggedOut) {
                console.log('[INFO] Reconnecting...')
                startSock()
            }
        } else if (connection === 'open') {
            console.log('[INFO] Connected successfully!')
        }
    })

    // Message event
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text
        if (!text) return
        console.log(`[MESSAGE] From ${msg.key.remoteJid}: ${text}`)

        // Simple command
        if (text === '!ping') {
            await sock.sendMessage(msg.key.remoteJid, { text: 'Pong!' })
        }
    })
}

startSock()
