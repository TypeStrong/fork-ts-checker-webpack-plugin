import * as ts from 'typescript';
import { normalize, dirname, basename, resolve, relative } from 'path';
import { TypeScriptConfigurationOverwrite } from '../TypeScriptConfigurationOverwrite';
import { FilesMatch } from '../../reporter';

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
  parseConfigFileHost: ts.ParseConfigFileHost,
  processedConfigFiles: string[] = []
): FilesMatch {
  const files = new Set<string>(parsedConfiguration.fileNames);
  if (typeof parsedConfiguration.options.configFilePath === 'string') {
    files.add(parsedConfiguration.options.configFilePath);
  }
  const dirs = new Set(Object.keys(parsedConfiguration.wildcardDirectories || {}));

  for (const projectReference of parsedConfiguration.projectReferences || []) {
    const configFile = typescript.resolveProjectReferencePath(projectReference);
    if (processedConfigFiles.includes(configFile)) {
      // handle circular dependencies
      continue;
    }
    const parsedConfiguration = parseTypeScriptConfiguration(
      typescript,
      configFile,
      dirname(configFile),
      {},
      parseConfigFileHost
    );
    const childDependencies = getDependenciesFromTypeScriptConfiguration(
      typescript,
      parsedConfiguration,
      parseConfigFileHost,
      [...processedConfigFiles, configFile]
    );
    childDependencies.files.forEach((file) => {
      files.add(file);
    });
    childDependencies.dirs.forEach((dir) => {
      dirs.add(dir);
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

export function isIncrementalCompilation(options: ts.CompilerOptions) {
  return Boolean((options.incremental || options.composite) && !options.outFile);
}

function removeJsonExtension(path: string) {
  if (path.endsWith('.json')) {
    return path.slice(0, -'.json'.length);
  } else {
    return path;
  }
}

function getTsBuildInfoEmitOutputFilePath(options: ts.CompilerOptions) {
  if (typeof ts.getTsBuildInfoEmitOutputFilePath === 'function') {
    // old TypeScript version doesn't provides this method
    return ts.getTsBuildInfoEmitOutputFilePath(options);
  }

  // based on the implementation from typescript
  const configFile = options.configFilePath as string;
  if (!isIncrementalCompilation(options)) {
    return undefined;
  }
  if (options.tsBuildInfoFile) {
    return options.tsBuildInfoFile;
  }
  const outPath = options.outFile || options.out;
  let buildInfoExtensionLess;
  if (outPath) {
    buildInfoExtensionLess = removeJsonExtension(outPath);
  } else {
    if (!configFile) {
      return undefined;
    }
    const configFileExtensionLess = removeJsonExtension(configFile);
    buildInfoExtensionLess = options.outDir
      ? options.rootDir
        ? resolve(options.outDir, relative(options.rootDir, configFileExtensionLess))
        : resolve(options.outDir, basename(configFileExtensionLess))
      : configFileExtensionLess;
  }
  return buildInfoExtensionLess + '.tsbuildinfo';
}

function getArtifactsFromTypeScriptConfiguration(
  typescript: typeof ts,
  parsedConfiguration: ts.ParsedCommandLine,
  configFileContext: string,
  parseConfigFileHost: ts.ParseConfigFileHost,
  processedConfigFiles: string[] = []
): FilesMatch {
  const files = new Set<string>();
  const dirs = new Set<string>();
  if (parsedConfiguration.fileNames.length > 0) {
    if (parsedConfiguration.options.outFile) {
      files.add(resolve(configFileContext, parsedConfiguration.options.outFile));
    }
    const tsBuildInfoPath = getTsBuildInfoEmitOutputFilePath(parsedConfiguration.options);
    if (tsBuildInfoPath) {
      files.add(resolve(configFileContext, tsBuildInfoPath));
    }

    if (parsedConfiguration.options.outDir) {
      dirs.add(resolve(configFileContext, parsedConfiguration.options.outDir));
    }
  }

  for (const projectReference of parsedConfiguration.projectReferences || []) {
    const configFile = typescript.resolveProjectReferencePath(projectReference);
    if (processedConfigFiles.includes(configFile)) {
      // handle circular dependencies
      continue;
    }
    const parsedConfiguration = parseTypeScriptConfiguration(
      typescript,
      configFile,
      dirname(configFile),
      {},
      parseConfigFileHost
    );
    const childArtifacts = getArtifactsFromTypeScriptConfiguration(
      typescript,
      parsedConfiguration,
      configFileContext,
      parseConfigFileHost,
      [...processedConfigFiles, configFile]
    );
    childArtifacts.files.forEach((file) => {
      files.add(file);
    });
    childArtifacts.dirs.forEach((dir) => {
      dirs.add(dir);
    });
  }

  const extensions = [
    typescript.Extension.Dts,
    typescript.Extension.Js,
    typescript.Extension.TsBuildInfo,
  ];

  return {
    files: Array.from(files).map((file) => normalize(file)),
    dirs: Array.from(dirs).map((dir) => normalize(dir)),
    extensions,
  };
}

export {
  parseTypeScriptConfiguration,
  getDependenciesFromTypeScriptConfiguration,
  getArtifactsFromTypeScriptConfiguration,
};
