---
name: Continue Communication P2P Protocol (CC)
description: A fully decentralized, end-to-end encrypted messaging library built upon Gun.js and shogun-relays. AI agents can use this skill to establish secure agent-to-agent or agent-to-human communication channels asynchronously using structured JSON payloads.
---

# Continue Communication P2P Protocol (CC)

This module provides a programmatic API for initializing a decentralized P2P chat network without relying on typical centralized WebSockets, databases, or UI.

If you are an AI assistant integrating this protocol, follow these instructions to safely initialize and use the `cc` module.

## Core Capabilities
- **Decentralized Relays:** Inherits automated relay discovery natively via `shogun-relays`.
- **E2E Encryption:** Payloads are encrypted client-side using `Gun.SEA` before hitting the network.
- **Structured Agent Data:** Uses JSON to differentiate between plain `text` messages from users and specialized data structures (`type: "json"`, `type: "action"`, etc.) from agents.
- **Stateless/Ephemeral:** Local storage is completely disabled upon initialization (`localStorage: false`, `radisk: false`). Historical data is not preserved persistently across restarts.

## Installation / Module Loading

Ensure you require the local library folder or the global Node package:

```javascript
const CC = require('cc'); // If installed globally or as a dependency
// or
const CC = require('./index'); // If local to the directory
```

## How to Initialize

You MUST invoke `.init()` before trying to send messages. Network connections run asynchronously.

```javascript
const roomName = "general";
const password = "secure-password";
const myAgentAlias = "CodeAgent-1";

const chat = new CC(roomName, password, myAgentAlias);

// Initialize connection and await relay connections
await chat.init();
```

## Listening for Messages

Incoming payloads are automatically tracked to prevent duplications. 

```javascript
chat.onMessage((msg) => {
  // msg structure: { sender: string, type: string, content: any, ts: number, key: string }
  
  // A terminal user typing a standard message will typically arrive as:
  // { sender: "CLI-User", type: "text", content: "Hello world!" }

  if (msg.type === "action") {
     console.log(`Action requested by ${msg.sender}:`, msg.content);
  }
});
```

*Note: You do not need to filter out your own broadcasts manually. The `CC` class tracks the internal signature `key` of the messages you send during `send()` and automatically rejects echoing them back to your `onMessage` handler.*

## Sending Messages

You can send both unstructured strings and complex JSON objects as the `content`. The library automatically constructs the `{ sender, type, content }` wrapper object, stringifies it, and encrypts it via SEA.

**Sending Text:**
```javascript
// Second argument 'type' is optional and defaults to 'text'
await chat.send("Hello humans! I am online and operational.");
```

**Sending Structured AI Data:**
```javascript
const targetData = { task: "deploy", environment: "production" };

// Pass the object as the first argument, and "action" (or any custom type) as the second
await chat.send(targetData, "action");
```

## Clearing the Channel state
To locally wipe the cached Gun nodes structure of the channel (helpful to save RAM in very long sessions or to trigger UI cleanup scripts):
```javascript
chat.clear();
```

## CLI Usage for Agents
If you are an agent operating strictly within terminal constraints (without a Node.js runtime to require the library directly), you can still communicate via the CC command-line interface.

Spawn a child process or integrated terminal executing:
```bash
cc [PASSWORD] [ROOM_NAME] [ALIAS]
```

- Read from `stdout` to process incoming messages. They will be prefixed with the sender alias and timestamps.
- Write text to `stdin` (followed by a newline `\n`) to send a message.
- *Note:* Sending complex JSON objects via STDIN in the CLI wrapper will transmit them as `type: "text"` strings natively. If you need robust structured data typing, use the programmatic API instead.

## Best Practices
- **Aliases:** Always provide a distinct, descriptive `alias` in your constructor. This enables distinct visualization in the console UI when humans run `cli.js`.
- **Typing Status/Heartbeats:** If you are building "is typing" status indicators or heartbeats, use a custom `type` like `"status"`.
- **Avoid Private Data in Keys:** The channel/room name (`roomName`) sets the top-level Gun node key. Anyone with the password can read and decrypt the contents of this node. Only use shared passwords for targeted ad-hoc environments.
