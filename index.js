const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const { state, saveState } = useSingleFileAuthState('./session.json')
const P = require('pino')
const moment = require('moment')

// Inisialisasi socket
async function startBot() {
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            if(lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut){
                startBot()
            } else {
                console.log('Session WA terlogout. Buat ulang session.')
            }
        } else if(connection === 'open') {
            console.log('BOT CONNECTED')
        }
    })

    sock.ev.on('creds.update', saveState)

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0]
        if(!message.message || message.key.fromMe) return // abaikan pesan sendiri

        const from = message.key.remoteJid
        const text = message.message.conversation || message.message.extendedTextMessage?.text
        console.log('EVENT PESAN MASUK:', from, text)

        // Pastikan bot admin bot (nomor bot) bisa akses
        const isAdminBot = message.key.participant ? false : true

        // Command !idgrup
        if(text?.startsWith('!idgrup') && isAdminBot){
            let grupId = from
            // jika user ngetik !idgrup [link]
            const args = text.split(' ')
            if(args[1]) {
                // ambil id dari link WA
                const link = args[1]
                const match = link.match(/https:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)
                if(match) grupId = match[1]
            }

            await sock.sendMessage(from, { text: `ID Grup: ${grupId}` })
        }
    })
}

startBot()
