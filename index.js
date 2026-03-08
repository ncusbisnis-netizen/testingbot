const {
default: makeWASocket,
useMultiFileAuthState,
fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const fs = require("fs")

async function start(){

const { state, saveCreds } = await useMultiFileAuthState("./session")

const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
version,
auth: state,
browser: ["Session Generator","Chrome","1.0"]
})

sock.ev.on("connection.update", async(update)=>{

const { connection } = update

if(connection === "open"){

console.log("LOGIN BERHASIL")

const session = fs.readFileSync("./session/creds.json")

const base64 = Buffer.from(session).toString("base64")

console.log("SESSION ANDA:")
console.log(base64)

}

})

sock.ev.on("creds.update", saveCreds)

// pairing code
if(!sock.authState.creds.registered){

const number = process.env.NUMBER

const code = await sock.requestPairingCode(number)

console.log("PAIRING CODE:")
console.log(code)

}

}

start()
