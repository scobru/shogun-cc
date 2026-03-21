const Gun = require('gun');
require('gun/sea');
const Relays = require('shogun-relays');
const fs = require('fs');
const path = require('path');

function logDebug(...args) {
  const msg = `[DEBUG ${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
  if (process.env.CC_DEBUG) {
    console.log(msg.trim());
  }
  try { fs.appendFileSync(path.join(process.cwd(), 'debug.log'), msg); } catch (e) { }
}

class CC {
  constructor(roomName = 'CC', password = 'CC-PASSWORD', alias = 'Anonymous') {
    this.roomName = roomName;
    this.password = password;
    this.alias = alias;
    this.gun = null;
    this.messages = null;
    // Allow up to 24 hours of clock drift between machines
    this.startTime = Date.now() - (24 * 60 * 60 * 1000);
    this.seen = new Set();
    this.onMessageCallback = null;
  }

  async init() {
    // Suppress "Could not decrypt" from SEA internally
    if (!console.__cc_wrapped) {
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;

      const isSilenced = (msg) => {
        if (!msg) return false;
        const str = typeof msg === 'string' ? msg : (msg.message || '');
        return str.includes('Could not decrypt') || 
               str.includes('No localStorage') || 
               str.includes('Hello wonderful person') || 
               str.includes('AXE relay enabled!');
      };

      console.log = function (...args) {
        if (isSilenced(args[0])) return;
        origLog.apply(console, args);
      };
      console.warn = function (...args) {
        if (isSilenced(args[0])) return;
        origWarn.apply(console, args);
      };
      console.error = function (...args) {
        if (isSilenced(args[0])) return;
        origError.apply(console, args);
      };
      console.__cc_wrapped = true;
    }

    const fetchedPeers = await Relays.forceListUpdate();
    const peers = fetchedPeers;
    logDebug(`Connecting to ${fetchedPeers.length} relays for maximal stability:`, peers);
    this.gun = Gun({ peers, localStorage: false, radisk: false });
    this.messages = this.gun.get(this.roomName);

    const processMessage = async (encData, key) => {
      if (encData && encData.text && !this.seen.has(key)) {
        logDebug(`Attempting decrypt for - key: ${key}`);
        this.seen.add(key);

        try {
          const decryptedText = await Gun.SEA.decrypt(encData.text, this.password);
          const decryptedTs = await Gun.SEA.decrypt(encData.ts, this.password);

          if (decryptedText && decryptedTs && decryptedTs >= this.startTime) {
            let parsedMsg = { sender: 'Unknown', type: 'text', content: decryptedText };

            if (typeof decryptedText === 'object') {
              parsedMsg = decryptedText;
            } else if (typeof decryptedText === 'string') {
              try {
                const parsed = JSON.parse(decryptedText);
                if (parsed && typeof parsed === 'object' && parsed.content !== undefined) {
                  parsedMsg = parsed;
                }
              } catch (e) { }
            }
            
            let preview = typeof parsedMsg.content === 'string' ? parsedMsg.content : (JSON.stringify(parsedMsg.content) || '');
            logDebug(`[SUCCESS] Decrypted msg - key: ${key}, sender: ${parsedMsg.sender}, snippet:`, preview.substring(0, 15));

            if (parsedMsg.msgId) {
                if (this.seen.has(parsedMsg.msgId)) return;
                this.seen.add(parsedMsg.msgId);
            }

            if (this.onMessageCallback) {
              this.onMessageCallback({
                ...parsedMsg,
                ts: decryptedTs,
                key
              });
            }
          } else {
            if (decryptedText && decryptedTs === undefined) {
              logDebug(`Message ignored (timestamp missing) - key: ${key}`);
            } else if (decryptedText && decryptedTs < this.startTime) {
              logDebug(`Message ignored (timestamp too old) - key: ${key}, msgTs: ${decryptedTs}, startTime: ${this.startTime}`);
            } else {
              logDebug(`Message ignored (missing fields or wrong password) - key: ${key}`);
            }
          }
        } catch (err) {
          logDebug(`Decrypt exception - key: ${key}`, err.message || err);
        }
      }
    };

    // Load history
    this.messages.map().on(processMessage);
    
    // Subscribe to the real-time broadcast scalar for 100% reliable live updates
    this.gun.get(this.roomName + '-latest').on((encData, key) => {
         if (encData && encData.keyId) {
             processMessage(encData, encData.keyId);
         }
    });

    return peers;
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  async send(content, type = 'text') {
    if (!this.messages) throw new Error('CC not initialized. Call init() first.');

    const msgId = Date.now() + '-' + Math.random().toString(36).slice(2);

    // Add to seen so we don't process our own broadcast back
    this.seen.add(msgId);

    // Construct structured payload
    const payload = {
      sender: this.alias,
      type: type,
      content: content,
      msgId: msgId
    };

    // Encrypt the stringified payload and timestamp
    const encryptedText = await Gun.SEA.encrypt(JSON.stringify(payload), this.password);
    const encryptedTs = await Gun.SEA.encrypt(Date.now(), this.password);

    logDebug(`Sending to relays - msgId: ${msgId}`);
    
    const nodeData = { text: encryptedText, ts: encryptedTs };

    // Use .set() for history map
    this.messages.set(nodeData, (ack) => {
      logDebug(`Set ack - msgId: ${msgId}`, ack);
      if (ack.err) logDebug(`Set error - msgId: ${msgId}`, ack.err);
    });
    
    // Broadcast on the guaranteed scalar node for immediate cross-relay push
    this.gun.get(this.roomName + '-latest').put({ ...nodeData, keyId: msgId });
    return msgId;
  }

  clear() {
    this.startTime = Date.now() - (24 * 60 * 60 * 1000);
    this.seen.clear();
  }
}

module.exports = CC;