const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');
const { handleMessage } = require('./handler');

// Logger configuration
const logger = P({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

// Cache for group metadata
const groupCache = new NodeCache({
  stdTTL: 5 * 60, // 5 minutes
  useClones: false
});

// Ensure auth folder exists
const authFolder = path.join(__dirname, '../auth');
if (!fs.existsSync(authFolder)) {
  fs.mkdirSync(authFolder, { recursive: true });
}

async function connectToWhatsApp() {
  try {
    // Load auth state from folder
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    // Fetch latest Baileys version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using Baileys version: ${version} (${isLatest ? 'latest' : 'update available'})`);

    // Create socket connection
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: true,
      logger: logger,
      browser: ['Heroku Bot', 'Chrome', '10.0'],
      syncFullHistory: true,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      
      // Cache group metadata untuk performa
      cachedGroupMetadata: async (jid) => {
        const cached = groupCache.get(jid);
        if (cached) return cached;
        
        const metadata = await sock.groupMetadata(jid);
        groupCache.set(jid, metadata);
        return metadata;
      },
      
      // Get message untuk retry system
      getMessage: async (key) => {
        const msg = await loadMessageFromStore(key);
        return msg?.message || undefined;
      }
    });

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        logger.info('📱 Scan QR code dengan WhatsApp Anda');
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error instanceof Boom) ?
          lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut :
          true;

        if (shouldReconnect) {
          logger.info('🔄 Koneksi terputus, mencoba reconnect...');
          connectToWhatsApp();
        } else {
          logger.error('❌ Logged out, hapus folder auth dan scan ulang');
          process.exit(1);
        }
      } else if (connection === 'open') {
        logger.info('✅ Bot WhatsApp berhasil terhubung!');
        logger.info(`📱 Nomor: ${sock.user?.id.split(':')[0]}`);
        
        // Kirim pesan notifikasi ke diri sendiri
        const selfJid = sock.user?.id;
        if (selfJid) {
          await sock.sendMessage(selfJid, {
            text: '🤖 Bot WhatsApp siap digunakan!\n' +
                  '📅 ' + new Date().toLocaleString('id-ID')
          });
        }
      }
    });

    // Handle group updates untuk cache
    sock.ev.on('groups.update', async ([event]) => {
      if (event.id) {
        try {
          const metadata = await sock.groupMetadata(event.id);
          groupCache.set(event.id, metadata);
        } catch (e) {
          logger.debug('Failed to update group cache:', e);
        }
      }
    });

    // Handle group participants update
    sock.ev.on('group-participants.update', async (event) => {
      if (event.id) {
        try {
          const metadata = await sock.groupMetadata(event.id);
          groupCache.set(event.id, metadata);
        } catch (e) {
          logger.debug('Failed to update group cache:', e);
        }
      }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        // Skip pesan dari kita sendiri dan pesan status
        if (type !== 'notify' && type !== 'append') return;
        
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        await handleMessage(sock, msg);
        
      } catch (error) {
        logger.error('Error handling message:', error);
      }
    });

    // Handle pesan yang diedit
    sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.key.fromMe) continue;
        
        // Log jika pesan diedit
        if (update.update.message) {
          logger.info(`✏️ Pesan diedit: ${JSON.stringify(update.key)}`);
        }
      }
    });

    // Handle presence updates
    sock.ev.on('presence.update', ({ id, presences }) => {
      // Optional: log presence updates
    });

    return sock;

  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Fungsi untuk load message dari store (implementasi sederhana)
async function loadMessageFromStore(key) {
  // Implementasi sesuai kebutuhan, bisa pakai database
  return null;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('👋 Mematikan bot...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('👋 Mematikan bot...');
  process.exit(0);
});

// Start the bot
logger.info('🚀 Memulai WhatsApp Bot...');
connectToWhatsApp();
