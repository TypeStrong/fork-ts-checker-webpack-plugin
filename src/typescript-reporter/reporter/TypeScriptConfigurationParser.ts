import * as ts from 'typescript';
import { TypeScriptConfigurationOverwrite } from '../TypeScriptConfigurationOverwrite';

function parseTypeScriptConfiguration(
  configFileName: string,
  configFileContext: string,
  configOverwriteJSON: TypeScriptConfigurationOverwrite,
  parseConfigFileHost: ts.ParseConfigFileHost
): ts.ParsedCommandLine {
  const parsedConfigFileJSON = ts.readConfigFile(configFileName, parseConfigFileHost.readFile);

  const overwrittenConfigFileJSON = {
    ...(parsedConfigFileJSON.config || {}),
    ...configOverwriteJSON,
    compilerOptions: {
      ...((parsedConfigFileJSON.config || {}).compilerOptions || {}),
      ...(configOverwriteJSON.compilerOptions || {}),
    },
  };

  const parsedConfigFile = ts.parseJsonConfigFileContent(
    overwrittenConfigFileJSON,
    parseConfigFileHost,
    configFileContext
  );

  return {
    ...parsedConfigFile,
    options: {
      ...parsedConfigFile.options,
      configFilePath: configFileName,
    },
    errors: parsedConfigFileJSON.error ? [parsedConfigFileJSON.error] : parsedConfigFile.errors,
  };
}

export { parseTypeScriptConfiguration };
