import { TypeScriptPnpExtensionOptions } from './TypeScriptPnpExtensionOptions';

interface TypeScriptPnpExtensionConfiguration {
  enabled: boolean;
}

function createTypeScriptPnpExtensionConfiguration(
  options: TypeScriptPnpExtensionOptions | undefined
): TypeScriptPnpExtensionConfiguration {
  return {
    enabled: options === true,
  };
}

export { TypeScriptPnpExtensionConfiguration, createTypeScriptPnpExtensionConfiguration };
