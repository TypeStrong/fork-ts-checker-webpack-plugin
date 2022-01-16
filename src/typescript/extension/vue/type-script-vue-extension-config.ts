import type { TypeScriptVueExtensionOptions } from './type-script-vue-extension-options';

interface TypeScriptVueExtensionConfig {
  enabled: boolean;
  compiler: string;
}

function createTypeScriptVueExtensionConfig(
  options: TypeScriptVueExtensionOptions | undefined
): TypeScriptVueExtensionConfig {
  return {
    enabled: options === true,
    compiler: 'vue-template-compiler',
    ...(typeof options === 'object' ? options : {}),
  };
}

export { TypeScriptVueExtensionConfig, createTypeScriptVueExtensionConfig };
