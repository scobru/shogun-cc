#!/usr/bin/env node
const CC = require('./index');
const chalk = require('chalk');
const ora = require('ora');
const readline = require('readline');
const os = require('os');

// The shared password to encrypt/decrypt messages
const ROOM_PASSWORD = process.argv[2] || 'CC-PASSWORD';
const ROOM_NAME = process.argv[3] || 'CC';

const defaultAlias = os.userInfo().username || 'CLI-User';
const ALIAS = process.argv[4] || defaultAlias;

console.clear();
console.log(chalk.cyan.bold(`
   ____  ____ 
  / ___|/ ___|
 | |   | |    
 | |___| |___ 
  \\____|\\____|  Continue Communication
`));
console.log(chalk.gray(`=====================================`));

if (!process.argv[2]) {
  console.log(chalk.yellow('⚠️  No password provided. Using default.'));
}
if (!process.argv[3]) {
  console.log(chalk.yellow(`⚠️  No channel provided. Using default (${chalk.bold(ROOM_NAME)}).`));
}
if (!process.argv[4]) {
  console.log(chalk.yellow(`⚠️  No alias provided. Using default (${chalk.bold(ALIAS)}).`));
}
console.log(chalk.gray(`=====================================\n`));

(async () => {
  try {
    const cc = new CC(ROOM_NAME, ROOM_PASSWORD, ALIAS);
    
    const spinner = ora('Searching for Shogun relays...').start();
    const peers = await cc.init();
    spinner.succeed(chalk.green(`Connected to ${peers.length} relay peers!`));

    const rl = readline.createInterface({ 
      input: process.stdin, 
      output: process.stdout,
      prompt: chalk.blue.bold(`${ALIAS} ❯ `)
    });

    console.log(chalk.cyan(`\n💬 Joined channel: ${chalk.bold(ROOM_NAME)}`));
    console.log(chalk.gray(`Type and press Enter to send messages. Use /clear to clean the console.\n`));

    cc.onMessage((msg) => {
      // Clear current prompt line before outputting received message
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      
      const timeStr = new Date(msg.ts).toLocaleTimeString();
      let displayContent = msg.content;
      
      if (typeof displayContent === 'object') {
        displayContent = JSON.stringify(displayContent);
      }

      if (msg.type !== 'text') {
        console.log(`${chalk.gray(`[${timeStr}]`)} ${chalk.magenta.bold(msg.sender)} ${chalk.dim(`[${msg.type}]`)} ❯ ${displayContent}`);
      } else {
        console.log(`${chalk.gray(`[${timeStr}]`)} ${chalk.green.bold(msg.sender)} ❯ ${displayContent}`);
      }
      
      rl.prompt(true);
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const text = line.trim();

      if (text === '/clear') {
        cc.clear();
        console.clear();
        console.log(chalk.italic.yellow('🧹 Console cleared.'));
        rl.prompt();
        return;
      }

      if (text) {
        // Optimistic local echo to keep UI fast
        readline.moveCursor(process.stdout, 0, -1);
        readline.clearLine(process.stdout, 0);
        const timeStr = new Date().toLocaleTimeString();
        console.log(`${chalk.gray(`[${timeStr}]`)} ${chalk.blue.bold(ALIAS)} ❯ ${text}`);

        try {
          await cc.send(text); // CLI sends as 'text' type
        } catch (e) {
          console.error(chalk.red('\n⚠️ Error sending message:'), e.message);
        }
      }
      
      rl.prompt();
    });

    rl.on('close', () => {
      console.log(chalk.yellow('\n👋 Goodbye!'));
      process.exit(0);
    });
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Initialization error:'), error);
  }
})();
