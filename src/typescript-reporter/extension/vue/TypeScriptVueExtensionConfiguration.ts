import { TypeScriptVueExtensionOptions } from './TypeScriptVueExtensionOptions';

interface TypeScriptVueExtensionConfiguration {
  enabled: boolean;
  compiler: string;
}

function createTypeScriptVueExtensionConfiguration(
  options: TypeScriptVueExtensionOptions | undefined
): TypeScriptVueExtensionConfiguration {
  return {
    enabled: options === true,
    compiler: 'vue-template-compiler',
    ...(typeof options === 'object' ? options : {}),
  };
}

export { TypeScriptVueExtensionConfiguration, createTypeScriptVueExtensionConfiguration };
