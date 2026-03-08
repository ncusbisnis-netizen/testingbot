const logger = require('pino')();

// Fungsi untuk handle pesan masuk
async function handleMessage(sock, msg) {
  try {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const messageType = Object.keys(msg.message)[0];
    const messageContent = msg.message[messageType];
    
    // Log pesan masuk
    logger.info({
      from: from,
      sender: sender,
      type: messageType,
      timestamp: msg.messageTimestamp
    });

    // Handle text message
    if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
      const text = messageType === 'conversation' 
        ? messageContent 
        : messageContent.text;
      
      if (!text) return;

      const command = text.toLowerCase().trim();
      
      // Command handler
      if (command === 'ping') {
        await sock.sendMessage(from, { text: '🏓 Pong!' });
      }
      else if (command === 'help') {
        await sendHelpMessage(sock, from);
      }
      else if (command === 'info') {
        await sendInfoMessage(sock, from);
      }
      else if (command === 'time') {
        await sock.sendMessage(from, { 
          text: `🕐 Waktu sekarang: ${new Date().toLocaleString('id-ID')}` 
        });
      }
      else if (command.startsWith('say ')) {
        const sayText = text.substring(4);
        if (sayText) {
          await sock.sendMessage(from, { text: sayText });
        }
      }
    }
    
    // Handle image message
    else if (messageType === 'imageMessage') {
      await sock.sendMessage(from, { 
        text: '🖼️ Gambar diterima! Caption: ' + (messageContent.caption || 'tanpa caption')
      });
    }
    
    // Handle sticker
    else if (messageType === 'stickerMessage') {
      await sock.sendMessage(from, { text: '🃏 Sticker keren!' });
    }
    
    // Handle group notifications
    else if (messageType === 'protocolMessage') {
      // Skip protocol messages
      return;
    }
    
  } catch (error) {
    logger.error('Error in message handler:', error);
  }
}

// Fungsi kirim pesan help
async function sendHelpMessage(sock, jid) {
  const helpText = `🤖 *Daftar Perintah*

*ping* - Cek koneksi bot
*help* - Menampilkan bantuan ini
*info* - Info bot
*time* - Menampilkan waktu sekarang
*say <teks>* - Bot akan mengulang teks Anda

📱 Bot menggunakan Baileys v6.7-rc.9`;
  
  await sock.sendMessage(jid, { text: helpText });
}

// Fungsi kirim info bot
async function sendInfoMessage(sock, jid) {
  const info = {
    text: `📊 *Info Bot*
    
⏰ Waktu: ${new Date().toLocaleString('id-ID')}
🤖 Platform: Heroku
📦 Library: @whiskeysockets/baileys v6.7-rc.9
🔄 Status: Online
💾 Session: Tersimpan`,
    contextInfo: {
      mentionedJid: []
    }
  };
  
  await sock.sendMessage(jid, info);
}

// Fungsi untuk handle media
async function handleMediaMessage(sock, msg, from, type) {
  try {
    const media = msg.message[type];
    await sock.sendMessage(from, {
      text: `📎 Media ${type} diterima! ${media.caption ? `\nCaption: ${media.caption}` : ''}`
    });
  } catch (error) {
    logger.error('Error handling media:', error);
  }
}

module.exports = { handleMessage };
