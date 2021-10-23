type TypeScriptVueExtensionOptions =
  | boolean
  | {
      enabled?: boolean;
      compiler?: string;
    };

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

export {
  TypeScriptVueExtensionOptions,
  TypeScriptVueExtensionConfig,
  createTypeScriptVueExtensionConfig,
};
