import { subcommands } from 'cmd-ts';

import init from './commands/init';

import keysGenerate from './commands/keys/generate';

import filesAdd from './commands/files/add';
import filesDecrypt from './commands/files/decrypt';
import filesEdit from './commands/files/edit';
import filesReencrypt from './commands/files/reencrypt';
import filesRemove from './commands/files/remove';

export default subcommands({
  name: 'caveau',
  version: '0.1.0',
  cmds: {
    init,
    'keys:generate': keysGenerate,
    'files:add': filesAdd,
    'files:decrypt': filesDecrypt,
    'files:edit': filesEdit,
    'files:reencrypt': filesReencrypt,
    'files:remove': filesRemove,
  },
});
