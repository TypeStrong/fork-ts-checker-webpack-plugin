import type { TypeScriptExtension } from '../../extension/TypeScriptExtension';
import { createTypeScriptVueExtension } from '../../extension/vue/TypeScriptVueExtension';

import { config } from './worker-config';

const extensions: TypeScriptExtension[] = [];

if (config.extensions?.vue?.enabled) {
  extensions.push(createTypeScriptVueExtension(config.extensions.vue));
}

export { extensions };
