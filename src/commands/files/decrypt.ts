import { dirname, resolve } from 'node:path';
import {
  boolean,
  command,
  flag,
  option,
  optional,
  restPositionals,
  string,
} from 'cmd-ts';
import { parse as parseDotEnv } from 'dotenv';
import { ResolvedPath } from '../../utils/File';
import { configFile } from '../../utils/configFile';
import { decryptFile, decryptFileAndWrite } from '../../utils/encryption';
import { privateKey } from '../../utils/prompt';

export default command({
  name: 'files:decrypt',
  description: 'Decrypt all secret files (or a specific one)',
  args: {
    explicitPaths: restPositionals({
      type: ResolvedPath,
      displayName: 'Paths of the secret files to decrypt',
    }),
    privateKey,
    toStdout: flag({
      type: boolean,
      short: 'o',
      long: 'stdout',
      description: 'Should the decrypted content be written to stdout instead?',
    }),
    envKey: option({
      type: optional(string),
      short: 'e',
      long: 'env-key',
      description:
        'Treats the file(s) as a dotenv file, looks for a specific env variable and prints it to stdout',
    }),
  },
  handler: async ({ explicitPaths, privateKey, toStdout, envKey }) => {
    const [config, _, configFilePath] = await configFile();

    const paths =
      explicitPaths.length > 0
        ? explicitPaths
        : config.files.map((path) => resolve(dirname(configFilePath), path));

    for (const file of paths) {
      if (envKey) {
        const decryptedFile = await decryptFile(file, privateKey);

        try {
          const parsed = parseDotEnv(decryptedFile);

          if (parsed[envKey]) {
            console.log(parsed[envKey]);
            break;
          }
        } catch (e) {
          console.error(`Error parsing file ${file} as dotenv file:`, e);
        }
      } else if (toStdout) {
        console.log(await decryptFile(file, privateKey));
      } else {
        await decryptFileAndWrite(file, privateKey);
      }
    }
  },
});
