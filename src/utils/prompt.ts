import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { option, optional, string } from 'cmd-ts';
import prompt from 'prompt-sync';
import { readFile, writeFile } from './readWrite';

const homeDir =
  process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME;

export const privateKeyFilename = '.kavo-privatekey';
export const privateKeyFilePath = homeDir && join(homeDir, privateKeyFilename);

export const privateKey = option({
  type: optional(string),
  short: 'p',
  long: 'private-key',
  env: 'PRIVATE_KEY',
  description: `Specify the private key to use (use wisely, it's better to ${privateKeyFilePath ? `store it in ~/${privateKeyFilename} or` : ''} pass it via env var)`,
});

export function askPrivateKey() {
  if (privateKeyFilePath && existsSync(privateKeyFilePath)) {
    return readFile(privateKeyFilePath);
  }

  // If stdin is not a TTY (e.g., in tests or CI), throw an error
  // since we can't prompt for the private key
  if (!process.stdin.isTTY) {
    throw new Error(
      'Private key not found. Please provide it via the --private-key flag or PRIVATE_KEY environment variable.',
    );
  }

  console.log();

  const prompter = prompt();
  const privateKey = prompter('Please enter your private key: ', { echo: '*' });

  if (!privateKey) {
    return askPrivateKey();
  }

  if (privateKeyFilePath) {
    if (confirm(`Do you want to save it to ${privateKeyFilePath}?`)) {
      writeFile(privateKeyFilePath, privateKey);
    }
  }

  return privateKey;
}

export function confirm(question: string): boolean {
  // If stdin is not a TTY (e.g., in tests or CI), return false
  if (!process.stdin.isTTY) {
    return false;
  }

  console.log();

  const prompter = prompt();
  const response = prompter(`${question} (y/n) `);

  if (!response) {
    return confirm(question);
  }

  return response.toLowerCase().trim() === 'y';
}
