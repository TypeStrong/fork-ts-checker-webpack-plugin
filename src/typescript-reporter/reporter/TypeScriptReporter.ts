import * as ts from 'typescript';
import path from 'path';
import { FilesMatch, Reporter } from '../../reporter';
import { createIssuesFromTsDiagnostics } from '../issue/TypeScriptIssueFactory';
import { TypeScriptReporterConfiguration } from '../TypeScriptReporterConfiguration';
import { createControlledWatchCompilerHost } from './ControlledWatchCompilerHost';
import { TypeScriptExtension } from '../extension/TypeScriptExtension';
import { createTypeScriptVueExtension } from '../extension/vue/TypeScriptVueExtension';
import { createControlledWatchSolutionBuilderHost } from './ControlledWatchSolutionBuilderHost';
import {
  ControlledTypeScriptSystem,
  createControlledTypeScriptSystem,
} from './ControlledTypeScriptSystem';
import {
  getDependenciesFromTypeScriptConfiguration,
  getArtifactsFromTypeScriptConfiguration,
  parseTypeScriptConfiguration,
  isIncrementalCompilation,
} from './TypeScriptConfigurationParser';
import { createPerformance } from '../../profile/Performance';
import { connectTypeScriptPerformance } from '../profile/TypeScriptPerformance';
import { createControlledCompilerHost } from './ControlledCompilerHost';

// write this type as it's available only in the newest TypeScript versions (^4.1.0)
interface Tracing {
  startTracing(configFilePath: string, traceDirPath: string, isBuildMode: boolean): void;
  stopTracing(typeCatalog: unknown): void;
  dumpLegend(): void;
}

function createTypeScriptReporter(configuration: TypeScriptReporterConfiguration): Reporter {
  let parsedConfiguration: ts.ParsedCommandLine | undefined;
  let parseConfigurationDiagnostics: ts.Diagnostic[] = [];
  let dependencies: FilesMatch | undefined;
  let artifacts: FilesMatch | undefined;
  let configurationChanged = false;
  let compilerHost: ts.CompilerHost | undefined;
  let watchCompilerHost:
    | ts.WatchCompilerHostOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>
    | undefined;
  let watchSolutionBuilderHost:
    | ts.SolutionBuilderWithWatchHost<ts.SemanticDiagnosticsBuilderProgram>
    | undefined;
  let program: ts.Program | undefined;
  let watchProgram:
    | ts.WatchOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>
    | undefined;
  let solutionBuilder: ts.SolutionBuilder<ts.SemanticDiagnosticsBuilderProgram> | undefined;
  let shouldUpdateRootFiles = false;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const typescript: typeof ts = require(configuration.typescriptPath);
  const extensions: TypeScriptExtension[] = [];
  const system: ControlledTypeScriptSystem = createControlledTypeScriptSystem(
    typescript,
    configuration.mode
  );
  const diagnosticsPerProject = new Map<string, ts.Diagnostic[]>();
  const performance = connectTypeScriptPerformance(typescript, createPerformance());

  if (configuration.extensions.vue.enabled) {
    extensions.push(createTypeScriptVueExtension(configuration.extensions.vue));
  }

  function getConfigFilePathFromCompilerOptions(compilerOptions: ts.CompilerOptions): string {
    return (compilerOptions.configFilePath as unknown) as string;
  }

  function getProjectNameOfBuilderProgram(builderProgram: ts.BuilderProgram): string {
    return getConfigFilePathFromCompilerOptions(builderProgram.getProgram().getCompilerOptions());
  }

  function getTracing(): Tracing | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (typescript as any).tracing;
  }

  function getDiagnosticsOfProgram(program: ts.Program | ts.BuilderProgram) {
    const diagnostics: ts.Diagnostic[] = [];

    if (configuration.diagnosticOptions.syntactic) {
      performance.markStart('Syntactic Diagnostics');
      diagnostics.push(...program.getSyntacticDiagnostics());
      performance.markEnd('Syntactic Diagnostics');
    }
    if (configuration.diagnosticOptions.global) {
      performance.markStart('Global Diagnostics');
      diagnostics.push(...program.getGlobalDiagnostics());
      performance.markEnd('Global Diagnostics');
    }
    if (configuration.diagnosticOptions.semantic) {
      performance.markStart('Semantic Diagnostics');
      diagnostics.push(...program.getSemanticDiagnostics());
      performance.markEnd('Semantic Diagnostics');
    }
    if (configuration.diagnosticOptions.declaration) {
      performance.markStart('Declaration Diagnostics');
      diagnostics.push(...program.getDeclarationDiagnostics());
      performance.markEnd('Declaration Diagnostics');
    }

    return diagnostics;
  }

  function emitTsBuildInfoFileForBuilderProgram(builderProgram: ts.BuilderProgram) {
    if (
      configuration.mode !== 'readonly' &&
      parsedConfiguration &&
      isIncrementalCompilation(parsedConfiguration.options)
    ) {
      const program = builderProgram.getProgram();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (program as any).emitBuildInfo === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (program as any).emitBuildInfo();
      }
    }
  }

  function getParseConfigFileHost() {
    const parseConfigDiagnostics: ts.Diagnostic[] = [];

    let parseConfigFileHost: ts.ParseConfigFileHost = {
      ...system,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        parseConfigDiagnostics.push(diagnostic);
      },
    };

    for (const extension of extensions) {
      if (extension.extendParseConfigFileHost) {
        parseConfigFileHost = extension.extendParseConfigFileHost(parseConfigFileHost);
      }
    }

    return [parseConfigFileHost, parseConfigDiagnostics] as const;
  }

  function parseConfiguration() {
    const [parseConfigFileHost, parseConfigDiagnostics] = getParseConfigFileHost();

    const parsedConfiguration = parseTypeScriptConfiguration(
      typescript,
      configuration.configFile,
      configuration.context,
      configuration.configOverwrite,
      parseConfigFileHost
    );

    if (parsedConfiguration.errors) {
      parseConfigDiagnostics.push(...parsedConfiguration.errors);
    }

    return [parsedConfiguration, parseConfigDiagnostics] as const;
  }

  function parseConfigurationIfNeeded(): ts.ParsedCommandLine {
    if (!parsedConfiguration) {
      [parsedConfiguration, parseConfigurationDiagnostics] = parseConfiguration();
    }

    return parsedConfiguration;
  }

  function getDependencies(): FilesMatch {
    parsedConfiguration = parseConfigurationIfNeeded();

    const [parseConfigFileHost] = getParseConfigFileHost();

    let dependencies = getDependenciesFromTypeScriptConfiguration(
      typescript,
      parsedConfiguration,
      parseConfigFileHost
    );

    for (const extension of extensions) {
      if (extension.extendDependencies) {
        dependencies = extension.extendDependencies(dependencies);
      }
    }

    return dependencies;
  }

  function getArtifacts(): FilesMatch {
    parsedConfiguration = parseConfigurationIfNeeded();

    const [parseConfigFileHost] = getParseConfigFileHost();

    return getArtifactsFromTypeScriptConfiguration(
      typescript,
      parsedConfiguration,
      configuration.context,
      parseConfigFileHost
    );
  }

  function getArtifactsIfNeeded(): FilesMatch {
    if (!artifacts) {
      artifacts = getArtifacts();
    }

    return artifacts;
  }

  function startProfilingIfNeeded() {
    if (configuration.profile) {
      performance.enable();
    }
  }

  function stopProfilingIfNeeded() {
    if (configuration.profile) {
      performance.print();
      performance.disable();
    }
  }

  function startTracingIfNeeded(compilerOptions: ts.CompilerOptions) {
    const tracing = getTracing();

    if (compilerOptions.generateTrace && tracing) {
      tracing.startTracing(
        getConfigFilePathFromCompilerOptions(compilerOptions),
        compilerOptions.generateTrace as string,
        configuration.build
      );
    }
  }

  function stopTracingIfNeeded(program: ts.BuilderProgram) {
    const tracing = getTracing();
    const compilerOptions = program.getCompilerOptions();

    if (compilerOptions.generateTrace && tracing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tracing.stopTracing((program.getProgram() as any).getTypeCatalog());
    }
  }

  function dumpTracingLegendIfNeeded() {
    const tracing = getTracing();

    if (tracing) {
      tracing.dumpLegend();
    }
  }

  return {
    getReport: async ({ changedFiles = [], deletedFiles = [] }, watching) => {
      // clear cache to be ready for next iteration and to free memory
      system.clearCache();

      if (
        [...changedFiles, ...deletedFiles]
          .map((affectedFile) => path.normalize(affectedFile))
          .includes(path.normalize(configuration.configFile))
      ) {
        // we need to re-create programs
        parsedConfiguration = undefined;
        dependencies = undefined;
        artifacts = undefined;
        compilerHost = undefined;
        watchCompilerHost = undefined;
        watchSolutionBuilderHost = undefined;
        program = undefined;
        watchProgram = undefined;
        solutionBuilder = undefined;

        diagnosticsPerProject.clear();
        configurationChanged = true;
      } else {
        const previousParsedConfiguration = parsedConfiguration;
        [parsedConfiguration, parseConfigurationDiagnostics] = parseConfiguration();

        if (
          previousParsedConfiguration &&
          JSON.stringify(previousParsedConfiguration.fileNames) !==
            JSON.stringify(parsedConfiguration.fileNames)
        ) {
          // root files changed - we need to recompute dependencies and artifacts
          dependencies = getDependencies();
          artifacts = getArtifacts();
          shouldUpdateRootFiles = true;
        }
      }

      parsedConfiguration = parseConfigurationIfNeeded();
      system.setArtifacts(getArtifactsIfNeeded());

      if (configurationChanged) {
        configurationChanged = false;

        // try to remove outdated .tsbuildinfo file for incremental mode
        if (
          typeof typescript.getTsBuildInfoEmitOutputFilePath === 'function' &&
          configuration.mode !== 'readonly' &&
          parsedConfiguration.options.incremental
        ) {
          const tsBuildInfoPath = typescript.getTsBuildInfoEmitOutputFilePath(
            parsedConfiguration.options
          );
          if (tsBuildInfoPath) {
            try {
              system.deleteFile(tsBuildInfoPath);
            } catch (error) {
              // silent
            }
          }
        }
      }

      return {
        async getDependencies() {
          if (!dependencies) {
            dependencies = getDependencies();
          }

          return dependencies;
        },
        async getIssues() {
          startProfilingIfNeeded();

          parsedConfiguration = parseConfigurationIfNeeded();

          // report configuration diagnostics and exit
          if (parseConfigurationDiagnostics.length) {
            let issues = createIssuesFromTsDiagnostics(typescript, parseConfigurationDiagnostics);

            issues.forEach((issue) => {
              if (!issue.file) {
                issue.file = configuration.configFile;
              }
            });

            extensions.forEach((extension) => {
              if (extension.extendIssues) {
                issues = extension.extendIssues(issues);
              }
            });

            return issues;
          }

          if (configuration.build) {
            // solution builder case
            // ensure watch solution builder host exists
            if (!watchSolutionBuilderHost) {
              performance.markStart('Create Solution Builder Host');
              watchSolutionBuilderHost = createControlledWatchSolutionBuilderHost(
                typescript,
                parsedConfiguration,
                system,
                (
                  rootNames,
                  compilerOptions,
                  host,
                  oldProgram,
                  configFileParsingDiagnostics,
                  projectReferences
                ) => {
                  if (compilerOptions) {
                    startTracingIfNeeded(compilerOptions);
                  }
                  return typescript.createSemanticDiagnosticsBuilderProgram(
                    rootNames,
                    compilerOptions,
                    host,
                    oldProgram,
                    configFileParsingDiagnostics,
                    projectReferences
                  );
                },
                undefined,
                undefined,
                undefined,
                undefined,
                (builderProgram) => {
                  const projectName = getProjectNameOfBuilderProgram(builderProgram);
                  const diagnostics = getDiagnosticsOfProgram(builderProgram);

                  // update diagnostics
                  diagnosticsPerProject.set(projectName, diagnostics);

                  // emit .tsbuildinfo file if needed
                  emitTsBuildInfoFileForBuilderProgram(builderProgram);

                  stopTracingIfNeeded(builderProgram);
                },
                extensions
              );
              performance.markEnd('Create Solution Builder Host');
              solutionBuilder = undefined;
            }

            // ensure solution builder exists and is up-to-date
            if (!solutionBuilder || shouldUpdateRootFiles) {
              // not sure if it's the best option - maybe there is a smarter way to do this
              shouldUpdateRootFiles = false;

              performance.markStart('Create Solution Builder');
              solutionBuilder = typescript.createSolutionBuilderWithWatch(
                watchSolutionBuilderHost,
                [configuration.configFile],
                {}
              );
              performance.markEnd('Create Solution Builder');

              performance.markStart('Build Solutions');
              solutionBuilder.build();
              performance.markEnd('Build Solutions');
            }
          } else if (watching) {
            // watch compiler case
            // ensure watch compiler host exists
            if (!watchCompilerHost) {
              performance.markStart('Create Watch Compiler Host');
              watchCompilerHost = createControlledWatchCompilerHost(
                typescript,
                parsedConfiguration,
                system,
                (
                  rootNames,
                  compilerOptions,
                  host,
                  oldProgram,
                  configFileParsingDiagnostics,
                  projectReferences
                ) => {
                  if (compilerOptions) {
                    startTracingIfNeeded(compilerOptions);
                  }
                  return typescript.createSemanticDiagnosticsBuilderProgram(
                    rootNames,
                    compilerOptions,
                    host,
                    oldProgram,
                    configFileParsingDiagnostics,
                    projectReferences
                  );
                },
                undefined,
                undefined,
                (builderProgram) => {
                  const projectName = getProjectNameOfBuilderProgram(builderProgram);
                  const diagnostics = getDiagnosticsOfProgram(builderProgram);

                  // update diagnostics
                  diagnosticsPerProject.set(projectName, diagnostics);

                  // emit .tsbuildinfo file if needed
                  emitTsBuildInfoFileForBuilderProgram(builderProgram);

                  stopTracingIfNeeded(builderProgram);
                },
                extensions
              );
              performance.markEnd('Create Watch Compiler Host');
              watchProgram = undefined;
            }

            // ensure watch program exists
            if (!watchProgram) {
              performance.markStart('Create Watch Program');
              watchProgram = typescript.createWatchProgram(watchCompilerHost);
              performance.markEnd('Create Watch Program');
            }

            if (shouldUpdateRootFiles && dependencies?.files) {
              // we have to update root files manually as don't use config file as a program input
              watchProgram.updateRootFileNames(dependencies.files);
              shouldUpdateRootFiles = false;
            }
          } else {
            if (!compilerHost) {
              compilerHost = createControlledCompilerHost(
                typescript,
                parsedConfiguration,
                system,
                extensions
              );
            }
            if (!program) {
              program = ts.createProgram({
                rootNames: parsedConfiguration.fileNames,
                options: parsedConfiguration.options,
                projectReferences: parsedConfiguration.projectReferences,
                host: compilerHost,
              });
            }
            const diagnostics = getDiagnosticsOfProgram(program);
            const projectName = getConfigFilePathFromCompilerOptions(program.getCompilerOptions());

            // update diagnostics
            diagnosticsPerProject.set(projectName, diagnostics);
          }

          changedFiles.forEach((changedFile) => {
            if (system) {
              system.invokeFileChanged(changedFile);
            }
          });
          deletedFiles.forEach((removedFile) => {
            if (system) {
              system.invokeFileDeleted(removedFile);
            }
          });

          // wait for all queued events to be processed
          performance.markStart('Queued Tasks');
          await system.waitForQueued();
          performance.markEnd('Queued Tasks');

          // aggregate all diagnostics and map them to issues
          const diagnostics: ts.Diagnostic[] = [];
          diagnosticsPerProject.forEach((projectDiagnostics) => {
            diagnostics.push(...projectDiagnostics);
          });
          let issues = createIssuesFromTsDiagnostics(typescript, diagnostics);

          extensions.forEach((extension) => {
            if (extension.extendIssues) {
              issues = extension.extendIssues(issues);
            }
          });

          dumpTracingLegendIfNeeded();
          stopProfilingIfNeeded();

          return issues;
        },
        async close() {
          // do nothing
        },
      };
    },
  };
}

export { createTypeScriptReporter };
