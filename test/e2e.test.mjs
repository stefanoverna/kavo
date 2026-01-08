import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CLI_PATH = resolve(ROOT_DIR, 'bin/kavo.mjs');

/**
 * Execute kavo CLI command
 */
function kavo(args = '', options = {}) {
  try {
    return execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: options.cwd || ROOT_DIR,
      ...options,
    });
  } catch (error) {
    // For commands that exit with non-zero (like --help), capture output
    return error.stdout || error.stderr;
  }
}

describe('Kavo E2E Tests', () => {
  let testDir;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDir = join(tmpdir(), `kavo-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('CLI Help Commands', () => {
    it('should show main help', () => {
      const output = kavo('--help');
      assert.match(output, /kavo <subcommand>/);
      assert.match(output, /keys:generate/);
      assert.match(output, /files:add/);
    });

    it('should show keys:generate help', () => {
      const output = kavo('keys:generate --help');
      assert.match(output, /Generates a new pair/);
      assert.match(output, /--save-private-key/);
    });
  });

  describe('Key Generation', () => {
    it('should generate valid age key pair', () => {
      const output = kavo('keys:generate');

      // Check for public key
      assert.match(output, /age1[a-z0-9]+/);
      assert.match(output, /Public key/);

      // Check for private key
      assert.match(output, /AGE-SECRET-KEY-1[A-Z0-9]+/);
      assert.match(output, /Private key/);
      assert.match(output, /NEVER SHARE/);
    });

    it('should generate different keys each time', () => {
      const output1 = kavo('keys:generate');
      const output2 = kavo('keys:generate');

      const key1 = output1.match(/AGE-SECRET-KEY-1[A-Z0-9]+/)[0];
      const key2 = output2.match(/AGE-SECRET-KEY-1[A-Z0-9]+/)[0];

      assert.notEqual(key1, key2, 'Generated keys should be unique');
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt a file', () => {
      const output = kavo('keys:generate');
      const privateKey = output.match(/AGE-SECRET-KEY-1[A-Z0-9]+/)[0];
      const publicKey = output.match(/age1[a-z0-9]+/)[0];

      // Create test files
      const configPath = join(testDir, '.kavo.json');
      const keyringPath = join(testDir, '.kavo-keyring.json');
      const secretPath = join(testDir, 'secret.txt');
      const secretContent = 'Hello, this is a secret message!';

      // Write secret file
      writeFileSync(secretPath, secretContent);

      // Create config
      writeFileSync(
        configPath,
        JSON.stringify({
          keyring: pathToFileURL(keyringPath).href,
          recipients: { type: 'all' },
          files: ['secret.txt'],
        }),
      );

      // Create keyring
      writeFileSync(
        keyringPath,
        JSON.stringify({
          publicKeys: { test: publicKey },
        }),
      );

      // Encrypt the file
      kavo('files:add secret.txt', {
        cwd: testDir,
        env: { ...process.env, PRIVATE_KEY: privateKey },
      });

      // Check encrypted file exists
      const encryptedPath = join(testDir, 'secret.txt.enc');
      assert.ok(
        readFileSync(encryptedPath, 'utf-8').includes('AGE ENCRYPTED FILE'),
      );

      // Delete original file
      rmSync(secretPath);

      // Decrypt the file
      kavo('files:decrypt secret.txt', {
        cwd: testDir,
        env: { ...process.env, PRIVATE_KEY: privateKey },
      });

      // Verify decrypted content matches original
      const decryptedContent = readFileSync(secretPath, 'utf-8');
      assert.strictEqual(decryptedContent, secretContent);
    });
  });

  describe('Config Initialization', () => {
    it('should initialize a config file', () => {
      const output = kavo('init', {
        cwd: testDir,
      });

      assert.match(output, /Written \.kavo\.json/);

      // Check config file was created
      const configPath = join(testDir, '.kavo.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      assert.strictEqual(typeof config.keyring, 'string');
      assert.ok(Array.isArray(config.files));
    });
  });
});
