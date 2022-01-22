import type { TypeScriptExtension } from '../../extension/type-script-extension';
import { createTypeScriptVueExtension } from '../../extension/vue/type-script-vue-extension';

import { config } from './worker-config';

const extensions: TypeScriptExtension[] = [];

if (config.extensions?.vue?.enabled) {
  extensions.push(createTypeScriptVueExtension(config.extensions.vue));
}

export { extensions };
