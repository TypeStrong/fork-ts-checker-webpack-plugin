import type { TypeScriptExtension } from '../../typescript-extension';
import { createTypeScriptVueExtension } from '../../vue/typescript-vue-extension';

import { config } from './worker-config';

const extensions: TypeScriptExtension[] = [];

if (config.extensions.vue.enabled) {
  extensions.push(createTypeScriptVueExtension(config.extensions.vue));
}

export { extensions };
