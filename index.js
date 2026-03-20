const Gun = require('gun');
require('gun/sea');
const Relays = require('shogun-relays');
const fs = require('fs');
const path = require('path');

function logDebug(...args) {
  const msg = `[DEBUG ${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
  console.log(msg.trim());
  try { fs.appendFileSync(path.join(process.cwd(), 'debug.log'), msg); } catch (e) { }
}

class CC {
  constructor(roomName = 'CC', password = 'CC-PASSWORD', alias = 'Anonymous') {
    this.roomName = roomName;
    this.password = password;
    this.alias = alias;
    this.gun = null;
    this.messages = null;
    // Allow up to 10 minutes of clock drift between machines
    this.startTime = Date.now() - (10 * 60 * 1000);
    this.seen = new Set();
    this.onMessageCallback = null;
  }

  async init() {
    // Suppress "Could not decrypt" from SEA internally
    if (!console.__cc_wrapped) {
      const origLog = console.log;
      console.log = function (...args) {
        if (args[0] === 'Could not decrypt' || (args[0] && args[0].message === 'Could not decrypt')) return;
        // Suppress GUN warnings and extra welcome messages
        if (typeof args[0] === 'string' && (args[0].includes('No localStorage') || args[0].includes('Hello wonderful person'))) return;
        if (args[0] === 'AXE relay enabled!') return;
        origLog.apply(console, args);
      };
      console.__cc_wrapped = true;
    }

    const peers = await Relays.forceListUpdate();
    logDebug('Fetched relays:', peers.length);
    this.gun = Gun({ peers, localStorage: false, radisk: false });
    this.messages = this.gun.get(this.roomName);

    this.messages.map().on(async (encData, key) => {
      // logDebug(`Received node update - key: ${key}, saw text?`, !!(encData && encData.text), 'already seen?', this.seen.has(key));
      if (encData && encData.text && !this.seen.has(key)) {
        logDebug(`Attempting decrypt for - key: ${key}`);
        this.seen.add(key);

        try {
          // Decrypt the text and timestamp
          const decryptedText = await Gun.SEA.decrypt(encData.text, this.password);
          const decryptedTs = await Gun.SEA.decrypt(encData.ts, this.password);

          if (decryptedText && decryptedTs && decryptedTs >= this.startTime) {
            logDebug(`[SUCCESS] Decrypted valid msg - key: ${key}, ts: ${decryptedTs}, text snippet:`, decryptedText.substring(0, 15));
            if (this.onMessageCallback) {
              let parsedMsg = { sender: 'Unknown', type: 'text', content: decryptedText };

              // Try parsing as structured agent payload
              try {
                const parsed = JSON.parse(decryptedText);
                if (parsed && typeof parsed === 'object' && parsed.content !== undefined) {
                  parsedMsg = parsed;
                }
              } catch (e) {
                // Ignore parsing errors, fallback to plain text format
              }

              this.onMessageCallback({
                ...parsedMsg,
                ts: decryptedTs,
                key
              });
            }
          } else {
            if (decryptedText) {
              logDebug(`Message ignored (timestamp too old) - key: ${key}, msgTs: ${decryptedTs}, startTime: ${this.startTime}`);
            } else {
              logDebug(`Message ignored (missing fields or wrong password) - key: ${key}`);
            }
          }
        } catch (err) {
          logDebug(`Decrypt exception - key: ${key}`, err.message || err);
          // Failed to decrypt, ignore message
        }
      }
    });

    return peers;
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  async send(content, type = 'text') {
    if (!this.messages) throw new Error('CC not initialized. Call init() first.');

    const key = Date.now() + '-' + Math.random().toString(36).slice(2);

    // Add to seen so we don't process our own broadcast back
    this.seen.add(key);

    // Construct structured payload
    const payload = {
      sender: this.alias,
      type: type,
      content: content
    };

    // Encrypt the stringified payload and timestamp
    const encryptedText = await Gun.SEA.encrypt(JSON.stringify(payload), this.password);
    const encryptedTs = await Gun.SEA.encrypt(Date.now(), this.password);

    logDebug(`Sending to relays - key: ${key}`);
    this.messages.get(key).put({ text: encryptedText, ts: encryptedTs }, (ack) => {
      logDebug(`Put ack - key: ${key}`, ack);
      if (ack.err) logDebug(`Put error - key: ${key}`, ack.err);
    });
    return key;
  }

  clear() {
    this.startTime = Date.now() - (10 * 60 * 1000);
    this.seen.clear();
  }
}

module.exports = CC;