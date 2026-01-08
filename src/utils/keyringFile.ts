import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fetch from 'cross-fetch';
import { uniq } from 'lodash-es';
import * as v from 'valibot';
import { configFile } from './configFile';

const KeyringFileSchema = v.object({
  $schema: v.optional(v.pipe(v.string(), v.url())),
  publicKeys: v.objectWithRest({}, v.pipe(v.string(), v.startsWith('age'))),
  teams: v.optional(v.objectWithRest({}, v.array(v.string()))),
});

export type KeyringFile = v.InferOutput<typeof KeyringFileSchema>;

export async function keyringFile(): Promise<KeyringFile> {
  const [config] = await configFile();

  let body: unknown;

  // Support file:// URLs for local testing
  if (config.keyring.startsWith('file://')) {
    const filePath = fileURLToPath(config.keyring);
    body = JSON.parse(readFileSync(filePath, 'utf-8'));
  } else {
    const response = await fetch(config.keyring);
    body = await response.json();
  }

  const result = v.safeParse(KeyringFileSchema, body);

  if (!result.success) {
    console.log(v.flatten<typeof KeyringFileSchema>(result.issues));
    throw new Error(`Invalid keyring file: ${config.keyring}`);
  }

  return result.output;
}

export async function findRecipientIds() {
  const [config] = await configFile();
  const keyring = await keyringFile();

  if (config.recipients.type === 'all') {
    const ids = Object.keys(keyring.publicKeys);

    if (ids.length === 0) {
      throw new Error('No recipients defined in config file.');
    }

    return uniq(ids);
  }

  let ids = config.recipients.publicKeyIds || [];

  const teamIds = config.recipients.teamIds;

  if (teamIds) {
    ids = [
      ...ids,
      ...teamIds.flatMap((teamId) => {
        if (!keyring.teams || !(teamId in keyring.teams)) {
          throw new Error(`No team "${teamId}" found in keyring.`);
        }

        return keyring.teams[teamId];
      }),
    ];
  }

  if (ids.length === 0) {
    throw new Error('No recipients defined in config file.');
  }

  return uniq(ids);
}

export async function findRecipientPublicKeys() {
  const keyring = await keyringFile();
  const recipientIds = await findRecipientIds();

  return recipientIds.map((id) => {
    if (!(id in keyring.publicKeys)) {
      throw new Error(`No public key for recipient "${id}" found in keyring.`);
    }

    return keyring.publicKeys[id];
  });
}
