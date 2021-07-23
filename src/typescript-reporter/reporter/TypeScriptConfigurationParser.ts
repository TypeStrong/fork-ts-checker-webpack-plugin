import type * as ts from 'typescript';
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
  configFileContext: string,
  parseConfigFileHost: ts.ParseConfigFileHost,
  processedConfigFiles: string[] = []
): FilesMatch {
  const files = new Set<string>(parsedConfiguration.fileNames);
  const configFilePath = parsedConfiguration.options.configFilePath;
  if (typeof configFilePath === 'string') {
    files.add(configFilePath);
  }
  const dirs = new Set(Object.keys(parsedConfiguration.wildcardDirectories || {}));
  const excluded = new Set<string>(
    (parsedConfiguration.raw?.exclude || []).map((path: string) => resolve(configFileContext, path))
  );

  for (const projectReference of parsedConfiguration.projectReferences || []) {
    const childConfigFilePath = typescript.resolveProjectReferencePath(projectReference);
    const childConfigContext = dirname(childConfigFilePath);
    if (processedConfigFiles.includes(childConfigFilePath)) {
      // handle circular dependencies
      continue;
    }
    const childParsedConfiguration = parseTypeScriptConfiguration(
      typescript,
      childConfigFilePath,
      childConfigContext,
      {},
      parseConfigFileHost
    );
    const childDependencies = getDependenciesFromTypeScriptConfiguration(
      typescript,
      childParsedConfiguration,
      childConfigContext,
      parseConfigFileHost,
      [...processedConfigFiles, childConfigFilePath]
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
    excluded: Array.from(excluded).map((path) => normalize(path)),
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

function getTsBuildInfoEmitOutputFilePath(typescript: typeof ts, options: ts.CompilerOptions) {
  if (typeof typescript.getTsBuildInfoEmitOutputFilePath === 'function') {
    // old TypeScript version doesn't provides this method
    return typescript.getTsBuildInfoEmitOutputFilePath(options);
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
    const tsBuildInfoPath = getTsBuildInfoEmitOutputFilePath(
      typescript,
      parsedConfiguration.options
    );
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
    excluded: [],
    extensions,
  };
}

export {
  parseTypeScriptConfiguration,
  getDependenciesFromTypeScriptConfiguration,
  getArtifactsFromTypeScriptConfiguration,
};
