const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")

async function start(){

const { state, saveCreds } = await useMultiFileAuthState("session")
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
version,
auth: state
})

sock.ev.on("connection.update", (update) => {

const { qr } = update

if(qr){
console.log("SCAN QR INI:")
console.log(qr)
}

})

sock.ev.on("creds.update", saveCreds)

}

start()
