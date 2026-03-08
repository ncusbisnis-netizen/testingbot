import makeWASocket, { useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import fs from "fs";

const { state, saveState } = useSingleFileAuthState("./session.json");

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: P({ level: 'info' }),
        printQRInTerminal: true,
        auth: state,
        version
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return; // ignore sent messages

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        console.log("EVENT PESAN MASUK", from, text);

        // hanya respon command yang dimulai dengan !idgrup
        if (text.startsWith("!idgrup")) {
            // cek apakah chat grup
            if (!from.endsWith("@g.us")) {
                await sock.sendMessage(from, { text: "Command ini hanya bisa dipakai di grup!" });
                return;
            }

            // cek admin bot (bot harus admin)
            const groupMetadata = await sock.groupMetadata(from);
            const botNumber = sock.user.id.split(":")[0];
            const botIsAdmin = groupMetadata.participants.find(p => p.id.split(":")[0] === botNumber)?.admin !== null;

            if (!botIsAdmin) {
                await sock.sendMessage(from, { text: "Bot harus admin untuk menjalankan command ini." });
                return;
            }

            // ambil ID grup
            await sock.sendMessage(from, { text: `ID Grup: ${from}` });
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("connection closed due to ", lastDisconnect.error, ", reconnecting ", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("BOT CONNECTED");
        }
    });

    sock.ev.on("creds.update", saveState);
}

startBot();
