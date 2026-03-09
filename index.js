const {
  default: makeWASocket,
  DisconnectReason,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  getAggregateVotesInPollMessage,
  PHONENUMBER_MCC,
  getBinaryNodeChild,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  jidDecode,
  proto,
  getContentType,
  useMultiFileAuthState,
  downloadContentFromMessage,
  prepareWAMessageMedia,
  delay,
  areJidsSameUser,
  extractMessageContent
} = require("@whiskeysockets/baileys")
const { Boom } = require('@hapi/boom')
const fs = require("fs");
const { pino } = require("pino");
const axios = require("axios");
const { exec } = require('child_process')

const OWNER = [
    "6281234567890@s.whatsapp.net",
    "306943953276@s.whatsapp.net"
]
const COOLDOWN_TIME = 2 * 60 * 1000
const getGroupAdmins = async (participants) => {
  let admins = []
  for (let i of participants) {
    i.admin === "superadmin" ? admins.push(i.id) :  i.admin === "admin" ? admins.push(i.id) : ''
    }
  return admins || []
}

let usePairingCode = true
async function main() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  //const { state, saveCreds } = await useMultiFileAuthState("src/database/naoSession");
  //const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
  const store ={}
  global.sock = makeWASocket({
		printQRInTerminal: !usePairingCode,
		syncFullHistory: true,
		markOnlineOnConnect: true,
		connectTimeoutMs: 60000, 
		defaultQueryTimeoutMs: 0,
		keepAliveIntervalMs: 10000,
		generateHighQualityLinkPreview: true, 
		patchMessageBeforeSending: (message) => {
			const requiresPatch = !!(
				message.buttonsMessage 
				|| message.templateMessage
				|| message.listMessage
			);
			if (requiresPatch) {
				message = {
					viewOnceMessage: {
						message: {
							messageContextInfo: {
								deviceListMetadataVersion: 2,
								deviceListMetadata: {},
							},
							...message,
						},
					},
				};
			}

			return message;
		},
		version: (await (await fetch('https://raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json')).json()).version,
		browser: ["Windows", "Chrome", "20.0.04"],
		logger: pino({ level: 'fatal' }),
		auth: { 
			creds: state.creds, 
			keys: makeCacheableSignalKeyStore(state.keys, pino().child({ 
				level: 'silent', 
				stream: 'store' 
			})), 
		}
	});
  

  sock.ev.on("connection.update", async (m) => {
    const { connection, lastDisconnect, qr } = m;
    if (qr) {
      if (usePairingCode && !sock.authState.creds.registered) {
    console.log('\nMasukan nomor yang aktif')
    const phoneNumber = '6283133199990'
    const code = await sock.requestPairingCode(phoneNumber.trim())
    console.log(`Kode pairing: ${code}`)
  }
    }
    if (connection === "close") {
      console.log(lastDisconnect);
      main();
    }
    if (connection === "open") {
      console.log(`Connected at ${sock.user.id}`);
    }
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async msg => {
    mek = msg.messages[0]
    if (!mek.message) return
    console.log(mek)
    m = await smsg(sock, mek, store)
    console.log(m)
    commandHandler(sock, m, msg, store);
  });
  sock.decodeJid = (jid) => {
    if (!jid) return jid
    if (/:\d+@/gi.test(jid)) {
    let decode = jidDecode(jid) || {}
    return decode.user && decode.server && decode.user + '@' + decode.server || jid
    } else return jid
  }
  sock.sendText = (jid, text, quoted = '', options) => sock.sendMessage(jid, { text: text, ...options }, { quoted })
  sock.profilePictureUrl = async (jid, type = 'image', timeoutMs) => {
		const result = await sock.query({
			tag: 'iq',
			attrs: {
				target: jidNormalizedUser(jid),
				to: '@s.whatsapp.net',
				type: 'get',
				xmlns: 'w:profile:picture'
			},
			content: [{
				tag: 'picture',
				attrs: {
					type, query: 'url'
				},
			}]
		}, timeoutMs);
		const child = getBinaryNodeChild(result, 'picture');
		return child?.attrs?.url;
	}
  sock.sendFileUrl = async (jid, url, caption = '', quoted = m, options = {}) => {
		async function getFileUrl(res, mime) {
			if (mime && mime.includes('gif')) {
				return sock.sendMessage(jid, { video: res.data, caption: caption, gifPlayback: true, ...options }, { quoted });
			} else if (mime && mime === 'application/pdf') {
				return sock.sendMessage(jid, { document: res.data, mimetype: 'application/pdf', caption: caption, ...options }, { quoted });
			} else if (mime && mime.includes('image')) {
				return sock.sendMessage(jid, { image: res.data, caption: caption, ...options }, { quoted });
			} else if (mime && mime.includes('video')) {
				return sock.sendMessage(jid, { video: res.data, caption: caption, mimetype: 'video/mp4', ...options }, { quoted });
			} else if (mime && mime.includes('audio')) {
				return sock.sendMessage(jid, { audio: res.data, mimetype: 'audio/mpeg', ...options }, { quoted });
			}
		}
		
		const res = await axios.get(url, { responseType: 'arraybuffer' });
		let mime = res.headers['content-type'];
		if (!mime || mime === 'application/octet-stream') {
			const fileType = await FileType.fromBuffer(res.data);
			mime = fileType ? fileType.mime : null;
		}
		const hasil = await getFileUrl(res, mime);
		return hasil
  }
  sock.copyNForward = async (jid, message, forceForward = false, options = {}) => {
      let vtype
      if (options.readViewOnce) {
         message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
         vtype = Object.keys(message.message.viewOnceMessage.message)[0]
         delete(message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
         delete message.message.viewOnceMessage.message[vtype].viewOnce
         message.message = {
            ...message.message.viewOnceMessage.message
         }
      }

      let mtype = Object.keys(message.message)[0]
      let content = await generateForwardMessageContent(message, forceForward)
      let ctype = Object.keys(content)[0]
      let context = {}
      if (mtype != "conversation") context = message.message[mtype].contextInfo
      content[ctype].contextInfo = {
         ...context,
         ...content[ctype].contextInfo
      }
      const waMessage = await generateWAMessageFromContent(jid, content, options ? {
         ...content[ctype],
         ...options,
         ...(options.contextInfo ? {
            contextInfo: {
               ...content[ctype].contextInfo,
               ...options.contextInfo
            }
         } : {})
      } : {})
      await sock.relayMessage(jid, waMessage.message, {
         messageId: waMessage.key.id
      })
      return waMessage
   }
   sock.downloadMediaMessage = async (message) => {
    let mime = (message.msg || message).mimetype || "";
    let messageType = message.mtype
      ? message.mtype.replace(/Message/gi, "")
      : mime.split("/")[0];
    const stream = await downloadContentFromMessage(message, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    return buffer;
  };
  
  sock.downloadAndSaveMediaMessage = async (
    message,
    filename,
    attachExtension = true
  ) => {
    let quoted = message.msg ? message.msg : message;
    let mime = quoted.mimetype || "";
    let messageType = message.mtype
      ? message.mtype.replace(/Message/gi, "")
      : mime.split("/")[0];
    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    let type = await FileType.fromBuffer(buffer);
    let trueFileName = attachExtension ? 'tmp/' + filename + "." + type.ext : filename;
    // save to file
    await fs.writeFileSync(trueFileName, buffer);
    return trueFileName;
  };
  sock.sendButtons = async (jid, header, body, footer, arrayButton, quoted, options) => {
    const msgs = generateWAMessageFromContent(jid, {
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({
                        text: body
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                        text: footer
                    }),
                    header: proto.Message.InteractiveMessage.Header.create({
                        hasMediaAttachment: false,
                        ...header
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: arrayButton
                    }),
                    ...options
                })
    }, { quoted })
    return sock.relayMessage(jid, msgs.message, { messageId: msgs.key.id });
  }
}

async function smsg(sock, m, store){
  try {
    if (!m) return m;
    let M = proto.WebMessageInfo;
    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') || m.key.id.startsWith('B1EY') || m.key.id.startsWith('3EB0') || m.key.id.startsWith('NXR') || m.key.id.startsWith('DEV')  || m.key.id.startsWith('ZYD') || m.key.id.startsWith('FELZ')
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat.endsWith('@g.us');
        m.sender = sock.decodeJid(m.fromMe && sock.user.id || m.participantAlt || m.key.participantAlt || m.key.remoteJidAlt || m.chat || '');
        m.isCreator = OWNER.includes(m.sender)
        }
    if (m.message) {
        m.mtype = getContentType(m.message);
        m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype]);
        m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath;
        m.mentions = [
              ...(m.msg?.contextInfo?.mentionedJid || []),
              ...(m.msg?.contextInfo?.groupMentions?.map((v) => v.groupJid) || [])
                  ];
        m.body =
              m.msg?.text ||
              m.msg?.conversation ||
              m.msg?.caption ||
              m.message?.conversation ||
              m.msg?.selectedButtonId ||
              m.msg?.singleSelectReply?.selectedRowId ||
              m.msg?.selectedId ||
              m.msg?.contentText ||
              m.msg?.selectedDisplayText ||
              m.msg?.title ||
              m.msg?.name ||
              "";
             if (m.message.interactiveResponseMessage) {
              m.body = JSON.parse(m.msg?.nativeFlowResponseMessage?.paramsJson).id
            }
        m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || '';
        if (m.isGroup) {
            groupMetadata = await sock.groupMetadata(m.chat).catch((e) => {})
            m.groupMetadata = {
                ...groupMetadata,
                groupAdmins: await getGroupAdmins(groupMetadata.participants)
            }
            m.isAdmin = (await getGroupAdmins(groupMetadata.participants)).includes(m.sender)
        }
        let quoted = m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null;
        m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];
        if (m.msg.caption) {
            m.caption = m.msg.caption;
            }
        if (m.quoted) {
        let type = Object.keys(m.quoted)[0];
        m.quoted = m.quoted[type];
        if (['productMessage'].includes(type)) {
            type = Object.keys(m.quoted)[0];
            m.quoted = m.quoted[type];
        }
        if (typeof m.quoted === 'string') m.quoted = {
            text: m.quoted
        };
        m.quoted.mtype = type;
        m.quoted.message = parseMessage(m.msg?.contextInfo?.quotedMessage);
        m.quoted.msg =
          parseMessage(m.quoted.message[m.quoted.mtype]) ||
          m.quoted.message[m.quoted.mtype];
        m.quoted.id = m.msg.contextInfo.stanzaId;
        m.quoted.device = /^3A/.test(m.quoted.id)
          ? "ios"
          : /^3E/.test(m.quoted.id)
            ? "web"
            : /^.{21}/.test(m.quoted.id)
              ? "android"
              : /^.{18}/.test(m.quoted.id)
                ? "desktop"
                : "unknown";
        m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;
        m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('B1EY') || m.quoted.id.startsWith('BAE5') || m.quoted.id.startsWith('3EB0') || m.quoted.id.startsWith('NXR') || m.quoted.id.startsWith('DEV') || m.quoted.id.startsWith('ZYD') : false;
        m.quoted.sender = sock.decodeJid(m.msg.contextInfo.participant);
        m.quoted.fromMe = m.quoted.sender === sock.decodeJid(sock.user.id);
        m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';
        m.quoted.key = {
              remoteJid: m.msg?.contextInfo?.remoteJid || m.from,
              participant: jidNormalizedUser(m.msg?.contextInfo?.participant),
              fromMe: areJidsSameUser(
                jidNormalizedUser(m.msg?.contextInfo?.participant),
                jidNormalizedUser(sock?.user?.id),
              ),
              id: m.msg?.contextInfo?.stanzaId,
        };
        m.quoted.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];
        m.getQuotedObj = m.getQuotedMessage = async () => {
            if (!m.quoted.id) return false;
            let q = await store.loadMessage(m.chat, m.quoted.id, sock);
            return smsg(sock, q, store);
        };
        let vM = m.quoted.fakeObj = M.fromObject({
        key: {
        remoteJid: m.quoted.chat,
        fromMe: m.quoted.fromMe,
        id: m.quoted.id
        },
        message: quoted,
        ...(m.isGroup ? { participant: m.quoted.sender } : {})
        });
        m.quoted.delete = () => sock.sendMessage(m.quoted.chat, { delete: vM.key });
        m.quoted.copyNForward = (jid, forceForward = false, options = {}) => sock.copyNForward(jid, vM, forceForward, options);
        m.quoted.download = () => sock.downloadMediaMessage(m.quoted);
        m.getQuotedObj = m.getQuotedMessage = async () => {
				if (!m.quoted.id) return false
				let q = await store.loadMessage(m.chat, m.quoted.id, sock)
				return smsg(sock, q, store)
			}
        }
        m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? sock.sendMedia(chatId, text, 'file', '', m, { ...options }) : sock.sendText(chatId, text, m, { ...options })
    }
    return m
    } catch (e) {
    console.log('serialize error\n' + e)
    }
};

function parseMessage(content) {
  content = extractMessageContent(content);

  if (content && content.viewOnceMessageV2Extension) {
    content = content.viewOnceMessageV2Extension.message;
  }
  if (
    content &&
    content.protocolMessage &&
    content.protocolMessage.type == 14
  ) {
    let type = getContentType(content.protocolMessage);
    content = content.protocolMessage[type];
  }
  if (content && content.message) {
    let type = getContentType(content.message);
    content = content.message[type];
  }

  return content;
}


async function commandHandler(sock, m, msg, store){
  try {
    const budy = (typeof m.text === 'string') ? m.text : '';
    const args = m.body.trim().split(/ +/).slice(1);
    let sender = m.sender
    const prefix = '!'
    const isCmd = m.body.startsWith(prefix);
    global.botNumber = sock.decodeJid(sock.user.id)
    const command = isCmd ? m.body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
    const isPublic = true
    const text = args.join(" ");
    
    
    switch (command) {
      case "ping": {
      m.reply('pong!')
      }
      break
      case 'bind': {
        if (!text) return m.reply(`!! INVALID COMMAND !!

> schema
${prefix}cekinfo [ id ] [ server ]

> example
${prefix}cekinfo 12345678 9123`)
      let a = text.split(' ')
      let id = a[0].replace(/\D/g, "")
      let server = a[1].replace(/\D/g, "")
      if (a.length < 2) return m.reply(`!! INVALID COMMAND !!

> schema
${prefix}cekinfo [ id ] [ server ]

> example
${prefix}cekinfo 12345678 9123`)
      let allowedGroup = m.isCreator ? m.isCreator : m.chat == '120363405087135761@g.us' ? m.chat == '120363405087135761@g.us' : false
      if (!allowedGroup) return m.reply(`Fitur ini hanya bisa digunakan di grup Area 51!\n\nhttps://chat.whatsapp.com/Dl0C42FbCfYLR8ZJxmuoTs`)
      let sender = m.sender
      let now = Date.now()
      sock.cooldown = sock.cooldown ? sock.cooldown : new Map()
      if (sock.cooldown.has(sender)) {
          let lastUse = sock.cooldown.get(sender)
          let remaining = COOLDOWN_TIME - (now - lastUse)

          if (remaining > 0) {
              let seconds = Math.ceil(remaining / 1000)
              let minutes = Math.floor(seconds / 60)
              let sisaDetik = seconds % 60

              return m.reply(
                  `Sabar bre, kan barusan udah.\nCobain lagi ntar abis ${minutes} menit ${sisaDetik} detik.`
              )
          }
      }
      try {
          let { data } = await fetch("https://checkton.online/backend/info", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "16WTy0RWfg8qN6Y3wbiXX77p-H7vF_B94dqaiMGjTPY"
            },
            body: JSON.stringify({
              role_id: id,
              zone_id: server,
              type: "bind"
            }).toString()
          }).then(res => res.json());
          if (/*data.accounts*/ data) {
            const getBind = (name) => {
              const acc = data.bind_accounts.find(v => v.platform.toLowerCase() === name)
              return acc && acc.connected ? acc.details : 'Empty.'
            }
            const longDate = (date) => {
                return (new Date(date)).toLocaleString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric'
                });
            }
            if (!m.isCreator) {
                sock.cooldown.set(sender, now)
            }
            m.reply(`*ACCOUNT INFO*

ID Server: ${data.role_id} (${data.zone_id})
Date Created: ${longDate(data.ttl)}

*BIND INFO*
• Moonton: ${getBind('moonton')}
• VK: ${getBind('vk')}
• Google Play: ${getBind('google')}
• TikTok: ${getBind('tiktok')}
• Facebook: ${getBind('facebook')}
• Apple: ${getBind('apple')}
• GCID: ${getBind('game center')}
• Telegram: ${getBind('telegram')}
• WhatsApp: ${getBind('whatsapp')}


*DEVICES*
Android: ${data.devices.android.total} (Active ${data.devices.android.active} | Inactive ${data.devices.android.inactive})
IOS: ${data.devices.ios.total} (Active ${data.devices.ios.active} | Inactive ${data.devices.ios.inactive})
Devices Total: ${data.devices.total_devices}

> 2021-2026 Reitzuu Project x AntiDEV`)
          } else {
            m.reply(`*ACCOUNT INFO*

ID Server: ${id} (${server})

This account is not associated with any Moonton, VK, Google Play, Tiktok, Facebook, Apple, or GCID account!`)
          }
      } catch (e) {
          m.reply('Terjadi kesalahan saat melakukan request')
          console.log(e)
      }
      }
      break
    default:
    }
    if (m.text.startsWith('>')) {
        if (!m.isCreator) return
        try {
            await sock.readMessages([m.key]);
            let evaled = await eval(m.text.slice(2))
            if (typeof evaled !== 'string') evaled = require('util').inspect(evaled)
            await m.reply(evaled)
        } catch (err) {
            await m.reply(String(err))
            console.log(err)
        }
    }
    if (m.text.startsWith('$')) {
        if (!m.isCreator) return
        try {
            await sock.readMessages([m.key]);
            exec(m.text.slice(2), (err, stdout) => {
                if (err) return m.reply(`${err}`)
                if (stdout) {
                    m.reply(stdout)
                }
            })
        } catch (err) {
            await m.reply(`${err}`)
            console.log(err)
        }
    }
  } catch (e) {
    console.error(e);
  }
};

main()
