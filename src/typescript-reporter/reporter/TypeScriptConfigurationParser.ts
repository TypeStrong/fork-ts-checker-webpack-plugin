import * as ts from 'typescript';

function parseTypeScriptConfiguration(
  configFileName: string,
  configFileContext: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customCompilerOptions: any,
  parseConfigFileHost: ts.ParseConfigFileHost
): ts.ParsedCommandLine {
  // convert jsonCompilerOptions to ts.CompilerOptions
  const customCompilerOptionsConvertResults = ts.convertCompilerOptionsFromJson(
    customCompilerOptions,
    configFileContext
  );

  const parsedConfigFile = ts.parseJsonSourceFileConfigFileContent(
    ts.readJsonConfigFile(configFileName, parseConfigFileHost.readFile),
    parseConfigFileHost,
    configFileContext,
    customCompilerOptionsConvertResults.options || {}
  );
  if (customCompilerOptionsConvertResults.errors) {
    parsedConfigFile.errors.push(...customCompilerOptionsConvertResults.errors);
  }

  return {
    ...parsedConfigFile,
    options: {
      ...parsedConfigFile.options,
      configFilePath: configFileName,
    },
  };
}

export { parseTypeScriptConfiguration };
