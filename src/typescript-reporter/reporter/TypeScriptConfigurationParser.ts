import * as ts from 'typescript';
import { normalize } from 'path';
import { TypeScriptConfigurationOverwrite } from '../TypeScriptConfigurationOverwrite';
import { Dependencies } from '../../reporter';

function parseTypeScriptConfiguration(
  typescript: typeof ts,
  configFileName: string,
  configFileContext: string,
  configOverwriteJSON: TypeScriptConfigurationOverwrite,
  parseConfigFileHost: ts.ParseConfigFileHost
): ts.ParsedCommandLine {
  const parsedConfigFileJSON = typescript.readConfigFile(
    configFileName,
    parseConfigFileHost.readFile
  );

  const overwrittenConfigFileJSON = {
    ...(parsedConfigFileJSON.config || {}),
    ...configOverwriteJSON,
    compilerOptions: {
      ...((parsedConfigFileJSON.config || {}).compilerOptions || {}),
      ...(configOverwriteJSON.compilerOptions || {}),
    },
  };

  const parsedConfigFile = typescript.parseJsonConfigFileContent(
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

function getDependenciesFromTypeScriptConfiguration(
  typescript: typeof ts,
  parsedConfiguration: ts.ParsedCommandLine,
  configFileContext: string,
  parseConfigFileHost: ts.ParseConfigFileHost,
  processedConfigFiles: string[] = []
): Dependencies {
  const files = new Set<string>(parsedConfiguration.fileNames);
  if (typeof parsedConfiguration.options.configFilePath === 'string') {
    files.add(parsedConfiguration.options.configFilePath);
  }
  const dirs = new Set(Object.keys(parsedConfiguration.wildcardDirectories || {}));

  if (parsedConfiguration.projectReferences) {
    parsedConfiguration.projectReferences.forEach((projectReference) => {
      const configFile = typescript.resolveProjectReferencePath(projectReference);
      if (processedConfigFiles.includes(configFile)) {
        // handle circular dependencies
        return;
      }
      const parsedConfiguration = parseTypeScriptConfiguration(
        typescript,
        configFile,
        configFileContext,
        {},
        parseConfigFileHost
      );
      const childDependencies = getDependenciesFromTypeScriptConfiguration(
        typescript,
        parsedConfiguration,
        configFileContext,
        parseConfigFileHost,
        [...processedConfigFiles, configFile]
      );
      childDependencies.files.forEach((file) => {
        files.add(file);
      });
      childDependencies.dirs.forEach((dir) => {
        dirs.add(dir);
      });
    });
  }

  const extensions = [
    typescript.Extension.Ts,
    typescript.Extension.Tsx,
    typescript.Extension.Js,
    typescript.Extension.Jsx,
    typescript.Extension.TsBuildInfo,
  ];

  return {
    files: Array.from(files).map((file) => normalize(file)),
    dirs: Array.from(dirs).map((dir) => normalize(dir)),
    extensions: extensions,
  };
}

export { parseTypeScriptConfiguration, getDependenciesFromTypeScriptConfiguration };
