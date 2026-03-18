# SHOGUN CC (Continue Communication)

CC is a terminal-based peer-to-peer encrypted chat application built upon [Gun.js](https://gun.eco/) and `shogun-relays`.

It uses SEA (Security, Encryption, Authorization) to exchange end-to-end encrypted messages and timestamps directly to other peers in a fully decentralized way without requiring persistence (localStorage or radisk are disabled).

## Features

- **P2P encrypted**: Relies on GUN SEA for end-to-end payload encryption. Only users who know the room password can decrypt messages.
- **Decentralized**: Uses shogun-relays to discover and connect to available GUN peers over the network.
- **CLI Chat**: Real-time terminal interface for chatting.
- **AI Agent & Script Ready**: Exposes a clean and fully asynchronous API to easily integrate CC programmatically into any Javascript project or AI backend.

---

## 1. CLI Usage

You can install `cc` globally on your system to use it directly from your terminal.

```bash
# From within the cc directory
npm install -g .
# Or use npm link
npm link
```

This will register the `cc` binary on both Linux/macOS and Windows, allowing you to run it from anywhere.

### Starting a Chat

```bash
cc [PASSWORD] [ROOM_NAME] [ALIAS]
```

- `PASSWORD`: The shared password used to encrypt and decrypt messages. Default is `CC-PASSWORD`.
- `ROOM_NAME`: The name of the channel/room you want to join. Default is `CC`.
- `ALIAS`: Your display name inside the chat. Default is your system username.

**Examples:**

```bash
cc                            # Join default room
cc secret general             # Join 'general' room using password 'secret'
cc secret general AgentSmith  # Join as 'AgentSmith'
```

### Special Commands

Inside the chat prompt, you can type special commands:

- `/clear` - Locally clears chat messages and clears the console screen.

---

## 2. Programmatic Usage (for AI Agents & Scripts)

You can import `CC` securely initialized without stdout or readline dependencies, and use it autonomously.

### Initialization & Messaging

```javascript
const CC = require("cc"); // or './index' if local

(async () => {
  // 1. Create a new CC instance
  const roomName = "general";
  const password = "my-secret-password";
  const chat = new CC(roomName, password);

  // 2. Initialize connection (returns the array of connected relay peers)
  const peers = await chat.init();
  console.log("Connected to Shogun Relays:", peers);

  // 3. Listen to incoming messages
  chat.onMessage((msg) => {
    console.log(
      `Received at ${new Date(msg.ts).toLocaleTimeString()}: ${msg.text}`,
    );
  });

  // 4. Send messages
  await chat.send("Hello from the AI agent!");
})();
```

### API Reference

#### `new CC(roomName = 'CC', password = 'CC-PASSWORD')`

Initializes the instance parameters. Connections do not start until you execute `init()`.

#### `await chat.init()`

Starts the Gun instance and fetches active network relays. Subscribes to new messages. Returns an array of connected string peer URLs.

#### `chat.onMessage(callback)`

Registers a listener that is triggered whenever a valid, correctly-decrypted message propagates to your node.

- `callback`: Function called with a single object `{ text: string, ts: number, key: string }`.

#### `await chat.send(text)`

Encrypts text and timestamp using SEA, propagates it to the P2P network, and caches the key locally so the network echo won't replay it on your `onMessage` handler.

- `text`: Normal string payload. Returns a promise that resolves the unique Gun `key` created for propagation.

#### `chat.clear()`

Wipes the local reference map to clear the historical messages.
