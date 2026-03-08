const makeWASocket = require("@whiskeysockets/baileys").default;
const { useSingleFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const P = require("pino");

const { state, saveState } = useSingleFileAuthState("./session.json");

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: P({ level: "info" }),
        printQRInTerminal: true,
        auth: state,
        version
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        console.log("EVENT PESAN MASUK", from, text);

        if (text.startsWith("!idgrup")) {
            // Hanya di grup
            if (!from.endsWith("@g.us")) {
                await sock.sendMessage(from, { text: "Command ini hanya bisa dipakai di grup!" });
                return;
            }

            // Cek bot admin
            const groupMetadata = await sock.groupMetadata(from);
            const botNumber = sock.user.id.split(":")[0];
            const botIsAdmin = groupMetadata.participants.find(p => p.id.split(":")[0] === botNumber)?.admin !== null;

            if (!botIsAdmin) {
                await sock.sendMessage(from, { text: "Bot harus admin untuk menjalankan command ini." });
                return;
            }

            // Kirim ID grup
            await sock.sendMessage(from, { text: `ID Grup: ${from}` });
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== 401);
            console.log("connection closed, reconnecting ", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("BOT CONNECTED");
        }
    });

    sock.ev.on("creds.update", saveState);
}

startBot();
