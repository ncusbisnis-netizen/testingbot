const { Client } = require('whatsapp-web.js');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// SESSION ID LU (isi dengan milik lu)
const sessionData = {
    WABrowserId: "13482392238087",
    WASecretBundle: "eyJub2lzZUtleSI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoieUtoUmU5dDgyWkMxL0FYTGx6cStzWE1yZi9ET1pVcS9LcTdpWENTME4yST0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiYStlR01JZDl6ZktqbjljYWRYKzZ6NHZPcWRWbVZyZHkyS09oWE1yYWtDdz0ifX0sInBhaXJpbmdFcGhlbWVyYWxLZXlQYWlyIjp7InByaXZhdGUiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiIySnB6eStKZzlDNlE5bXlreFdqR3dlbW5raVU3d25sMUVRODcxamtLUkd3PSJ9LCJwdWJsaWMiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJHR0F1OHNFb3M3aWtXam81VDZ1UnByUE9aY0MzQWdnSGhHaFllcVgzSG5BPSJ9fSwic2lnbmVkSWRlbnRpdHlLZXkiOnsicHJpdmF0ZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IldLWXMwcjRwaVo5dm5lTmtla2pNZ0I5aHNUOXkvRzFrN2hDbE4wQ2dVWE09In0sInB1YmxpYyI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6InpqamRoRDZnNmRvVHdtOHdCZzFXOWIzUFZkL3VHc1N2d1dveDdQSWNIbUE9In19LCJzaWduZWRQcmVLZXkiOnsia2V5UGFpciI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiT1B6M0ZwSEFYS2hGMDZ5eDJ0NHdYVVhzemlkdmVPL24vZmtNMXNlcUVXUT0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoibWdqa3kwbWdvS0IvTkNRMlQxd3ltd2dscFlPRk14dHE4RHR1ZlBScUozWT0ifX0sInNpZ25hdHVyZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6Ijk4S3dPcGNFdERnRzZGU3Q4dFZ3eWhqY1IvcUUxV2o4ZGc1R3QxNTNnN0VJWjdDcXREMFRabUZpdWhLdmhSQlEyTUtLL0pPYkYwUDFKM2pOZzhjUmhnPT0ifSwia2V5SWQiOjF9LCJyZWdpc3RyYXRpb25JZCI6MTg3LCJhZHZTZWNyZXRLZXkiOiIyVVJSSXpCSU1JcHJES2U1T2hKMTdlMlFCdEhLck1FWDJpUC84bCswOVVrPSIsInByb2Nlc3NlZEhpc3RvcnlNZXNzYWdlcyI6W10sIm5leHRQcmVLZXlJZCI6MzEsImZpcnN0VW51cGxvYWRlZFByZUtleUlkIjozMSwiYWNjb3VudFN5bmNDb3VudGVyIjowLCJhY2NvdW50U2V0dGluZ3MiOnsidW5hcmNoaXZlQ2hhdHMiOmZhbHNlfSwicmVnaXN0ZXJlZCI6dHJ1ZSwicGFpcmluZ0NvZGUiOiJLNEtUTjJMOCIsIm1lIjp7ImlkIjoiNjI4MzEzMzE5OTk5MDo0QHMud2hhdHNhcHAubmV0IiwibmFtZSI6Ik5jdXMiLCJsaWQiOiIxMzQ4MjM5MjIzODA4NzA6NEBsaWQifSwiYWNjb3VudCI6eyJkZXRhaWxzIjoiQ01udTY3a0JFUFhucnMwR0dBSWdBQ2dBIiwiYWNjb3VudFNpZ25hdHVyZUtleSI6ImltN2JXTzY2a3JKSnJ0aTF2cjNwSUxNQm94dVVtVkpUVEJIb0NTbXc0a0U9IiwiYWNjb3VudFNpZ25hdHVyZSI6IjVEQndZc1ZFekQ5RUtXWlRWa3cxSjVYM2VwUCt5czhnTklYSlNaWS9Hc00xeTRXUFNsQ3M4c3FBN1dRWW42dTFpOXZuSUJJdG9sVnZ2QVVWbms5c0FBPT0iLCJkZXZpY2VTaWduYXR1cmUiOiJLMzI0WkhTUDAxbnRRenpReHFIVTF6S3NxM0JMRVFoSXRLNW41TTdpbytvdGluNVIrSUkzS2YxOGxkY2dDek4ySkhlM01DVUJsT3dlQ29TekxQWDhndz09In0sInNpZ25hbElkZW50aXRpZXMiOlt7ImlkZW50aWZpZXIiOnsibmFtZSI6IjYyODMxMzMxOTk5OTA6NEBzLndoYXRzYXBwLm5ldCIsImRldmljZUlkIjowfSwiaWRlbnRpZmllcktleSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IkJZcHUyMWp1dXBLeVNhN1l0YjY5NlNDekFhTWJsSmxTVTB3UjZBa3BzT0pCIn19XSwicGxhdGZvcm0iOiJzbWJhIiwicm91dGluZ0luZm8iOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJDQVVJRWdnSSJ9LCJsYXN0QWNjb3VudFN5bmNUaW1lc3RhbXAiOjE3NzI4NjA0MDgsImxhc3RQcm9wSGFzaCI6IjNSOVozOSIsIm15QXBwU3RhdGVLZXlJZCI6IkFBQUFBSEtEIn0=",
    WAToken1: "PdO2a6T0raAw6V1A0InZq2p75Z/FipJvYQZzX2MhZcw=",
    WAToken2: "qGXb7JvhYopx2tTLHheDp7W8X5YhK5ZVnKdHjNhLj2o="
};

// PATH CHROME YANG SUDAH PASTI
const CHROME_PATH = '/app/.apt/opt/google/chrome/chrome';

// CEK APAKAH FILE ADA
if (fs.existsSync(CHROME_PATH)) {
    console.log('✅ Chrome ditemukan di:', CHROME_PATH);
} else {
    console.log('❌ Chrome TIDAK ditemukan di:', CHROME_PATH);
}

// INIT BOT
const client = new Client({
    session: sessionData,
    puppeteer: {
        headless: true,
        executablePath: CHROME_PATH,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote'
        ]
    }
});

client.on('ready', () => {
    console.log('✅ BOT SIAP!');
    console.log('📱 Nomor:', client.info.wid.user);
});

client.on('message', msg => {
    console.log('📨 Pesan:', msg.body);
    if (msg.body === '!ping') {
        msg.reply('pong');
    }
});

app.get('/', (req, res) => res.send('Bot WhatsApp Jalan!'));
app.listen(PORT, '0.0.0.0', () => console.log('🌐 Web:', PORT));

client.initialize();
