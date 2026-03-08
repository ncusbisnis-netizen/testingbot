import crypto from "crypto"
import { promises as fs } from "fs"
import P from "pino"
import {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeInMemoryStore
} from "@whiskeysockets/baileys"

const OWNER = ["6281234567890@s.whatsapp.net"]

const store = makeInMemoryStore({
  logger: P().child({ level: "silent", stream: "store" })
})

async function startBot() {
  if (process.env.SESSION && !(await fs.stat("./session/creds.json").catch(()=>false))) {
    const session = JSON.parse(
      Buffer.from(process.env.SESSION, "base64").toString()
    )
    await fs.mkdir("./session", { recursive: true })
    await fs.writeFile("./session/creds.json", JSON.stringify(session, null, 2))
    console.log("SESSION LOADED")
  }

  const { state, saveCreds } = await useMultiFileAuthState("session")
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ["Bot", "Chrome", "1.0"],
    markOnlineOnConnect: true,
    logger: P({ level: "silent" })
  })

  store.bind(sock.ev)

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        console.log("RECONNECTING...")
        startBot()
      }
    }
    if (connection === "open") console.log("BOT CONNECTED")
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0]
      if (!msg.message || msg.key.remoteJid === "status@broadcast") return

      const from = msg.key.remoteJid
      const isGroup = from.endsWith("@g.us")
      let body = ""

      if (msg.message.conversation) body = msg.message.conversation
      else if (msg.message.extendedTextMessage) body = msg.message.extendedTextMessage.text
      else if (msg.message.ephemeralMessage)
        body = msg.message.ephemeralMessage.message?.extendedTextMessage?.text || ""

      if (!body) return
      body = body.toLowerCase()
      console.log("PESAN:", body)

      await sock.readMessages([msg.key])

      // ===== COMMAND =====
      if (body === "ping") await sock.sendMessage(from, { text: "pong 🏓" })

      if (body === "menu")
        await sock.sendMessage(from, {
          text: `🤖 MENU BOT\n\nping\nmenu\n!idgrup\n!tagall`
        })

      if (body === "!idgrup") {
        if (!isGroup) return sock.sendMessage(from, { text: "❌ hanya di grup" })
        await sock.sendMessage(from, { text: `ID Grup:\n${from}` })
      }

      if (body === "!tagall") {
        if (!isGroup) return
        const group = await sock.groupMetadata(from)
        let members = group.participants.map((p) => p.id)
        let teks = "📢 TAG ALL\n\n"
        for (let m of members) teks += `@${m.split("@")[0]}\n`
        await sock.sendMessage(from, { text: teks, mentions: members })
      }
    } catch (err) {
      console.log("ERROR:", err)
    }
  })
}

startBot()
