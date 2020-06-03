import * as ts from 'typescript';
import path from 'path';
import { FilesChange, Reporter } from '../../reporter';
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
import { parseTypeScriptConfiguration } from './TypeScriptConfigurationParser';
import { createPerformance } from '../../profile/Performance';
import { connectTypeScriptPerformance } from '../profile/TypeScriptPerformance';

function createTypeScriptReporter(configuration: TypeScriptReporterConfiguration): Reporter {
  const extensions: TypeScriptExtension[] = [];

  let system: ControlledTypeScriptSystem | undefined;
  let parsedConfiguration: ts.ParsedCommandLine | undefined;
  let configurationChanged = false;
  let watchCompilerHost:
    | ts.WatchCompilerHostOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>
    | undefined;
  let watchSolutionBuilderHost:
    | ts.SolutionBuilderWithWatchHost<ts.SemanticDiagnosticsBuilderProgram>
    | undefined;
  let watchProgram: ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram> | undefined;
  let solutionBuilder: ts.SolutionBuilder<ts.SemanticDiagnosticsBuilderProgram> | undefined;

  const diagnosticsPerProject = new Map<string, ts.Diagnostic[]>();
  const performance = connectTypeScriptPerformance(createPerformance());

  if (configuration.extensions.vue.enabled) {
    extensions.push(createTypeScriptVueExtension(configuration.extensions.vue));
  }

  function getProjectNameOfBuilderProgram(builderProgram: ts.BuilderProgram): string {
    return (builderProgram.getProgram().getCompilerOptions().configFilePath as unknown) as string;
  }

  function getDiagnosticsOfBuilderProgram(builderProgram: ts.BuilderProgram) {
    const diagnostics: ts.Diagnostic[] = [];

    if (configuration.diagnosticOptions.syntactic) {
      performance.markStart('Syntactic Diagnostics');
      diagnostics.push(...builderProgram.getSyntacticDiagnostics());
      performance.markEnd('Syntactic Diagnostics');
    }
    if (configuration.diagnosticOptions.global) {
      performance.markStart('Global Diagnostics');
      diagnostics.push(...builderProgram.getGlobalDiagnostics());
      performance.markEnd('Global Diagnostics');
    }
    if (configuration.diagnosticOptions.semantic) {
      performance.markStart('Semantic Diagnostics');
      diagnostics.push(...builderProgram.getSemanticDiagnostics());
      performance.markEnd('Semantic Diagnostics');
    }
    if (configuration.diagnosticOptions.declaration) {
      performance.markStart('Declaration Diagnostics');
      diagnostics.push(...builderProgram.getDeclarationDiagnostics());
      performance.markEnd('Declaration Diagnostics');
    }

    return diagnostics;
  }

  function emitTsBuildInfoFileForBuilderProgram(builderProgram: ts.BuilderProgram) {
    if (
      configuration.mode !== 'readonly' &&
      parsedConfiguration &&
      parsedConfiguration.options.incremental
    ) {
      const program = builderProgram.getProgram();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (program as any).emitBuildInfo === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (program as any).emitBuildInfo();
      }
    }
  }

  return {
    getReport: async ({ changedFiles = [], deletedFiles = [] }: FilesChange) => {
      if (configuration.profile) {
        performance.enable();
      }

      if (!system) {
        system = createControlledTypeScriptSystem(configuration.mode);
      }

      // clear cache to be ready for next iteration and to free memory
      system.clearCache();

      if (
        [...changedFiles, ...deletedFiles]
          .map((affectedFile) => path.normalize(affectedFile))
          .includes(path.normalize(configuration.tsconfig))
      ) {
        // we need to re-create programs
        parsedConfiguration = undefined;
        watchCompilerHost = undefined;
        watchSolutionBuilderHost = undefined;
        watchProgram = undefined;
        solutionBuilder = undefined;

        diagnosticsPerProject.clear();
        configurationChanged = true;
      }

      if (!parsedConfiguration) {
        const parseConfigurationDiagnostics: ts.Diagnostic[] = [];

        performance.markStart('Parse Configuration');
        parsedConfiguration = parseTypeScriptConfiguration(
          configuration.tsconfig,
          configuration.context,
          configuration.compilerOptions,
          {
            ...system,
            onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
              parseConfigurationDiagnostics.push(diagnostic);
            },
          }
        );
        performance.markEnd('Parse Configuration');

        if (parsedConfiguration.errors) {
          parseConfigurationDiagnostics.push(...parsedConfiguration.errors);
        }

        // report configuration diagnostics and exit
        if (parseConfigurationDiagnostics.length) {
          parsedConfiguration = undefined;
          let issues = createIssuesFromTsDiagnostics(parseConfigurationDiagnostics);

          issues.forEach((issue) => {
            if (!issue.file) {
              issue.file = configuration.tsconfig;
            }
          });

          extensions.forEach((extension) => {
            if (extension.extendIssues) {
              issues = extension.extendIssues(issues);
            }
          });

          return issues;
        }

        if (configurationChanged) {
          configurationChanged = false;

          // try to remove outdated .tsbuildinfo file for incremental mode
          if (
            typeof ts.getTsBuildInfoEmitOutputFilePath === 'function' &&
            configuration.mode !== 'readonly' &&
            parsedConfiguration.options.incremental
          ) {
            const tsBuildInfoPath = ts.getTsBuildInfoEmitOutputFilePath(
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
      }

      if (configuration.build) {
        // solution builder case
        // ensure watch solution builder host exists
        if (!watchSolutionBuilderHost) {
          performance.markStart('Create Solution Builder Host');
          watchSolutionBuilderHost = createControlledWatchSolutionBuilderHost(
            parsedConfiguration,
            system,
            ts.createSemanticDiagnosticsBuilderProgram,
            undefined,
            undefined,
            undefined,
            undefined,
            (builderProgram) => {
              const projectName = getProjectNameOfBuilderProgram(builderProgram);
              const diagnostics = getDiagnosticsOfBuilderProgram(builderProgram);

              // update diagnostics
              diagnosticsPerProject.set(projectName, diagnostics);

              // emit .tsbuildinfo file if needed
              emitTsBuildInfoFileForBuilderProgram(builderProgram);
            },
            extensions
          );
          performance.markEnd('Create Solution Builder Host');
          solutionBuilder = undefined;
        }

        // ensure solution builder exists
        if (!solutionBuilder) {
          performance.markStart('Create Solution Builder');
          solutionBuilder = ts.createSolutionBuilderWithWatch(
            watchSolutionBuilderHost,
            [configuration.tsconfig],
            {}
          );
          performance.markEnd('Create Solution Builder');

          performance.markStart('Build Solutions');
          solutionBuilder.build();
          performance.markEnd('Build Solutions');
        }
      } else {
        // watch compiler case
        // ensure watch compiler host exists
        if (!watchCompilerHost) {
          performance.markStart('Create Watch Compiler Host');
          watchCompilerHost = createControlledWatchCompilerHost(
            parsedConfiguration,
            system,
            ts.createSemanticDiagnosticsBuilderProgram,
            undefined,
            undefined,
            (builderProgram) => {
              const projectName = getProjectNameOfBuilderProgram(builderProgram);
              const diagnostics = getDiagnosticsOfBuilderProgram(builderProgram);

              // update diagnostics
              diagnosticsPerProject.set(projectName, diagnostics);

              // emit .tsbuildinfo file if needed
              emitTsBuildInfoFileForBuilderProgram(builderProgram);
            },
            extensions
          );
          performance.markEnd('Create Watch Compiler Host');
          watchProgram = undefined;
        }

        // ensure watch program exists
        if (!watchProgram) {
          performance.markStart('Create Watch Program');
          watchProgram = ts.createWatchProgram(watchCompilerHost);
          performance.markEnd('Create Watch Program');
        }
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
      let issues = createIssuesFromTsDiagnostics(diagnostics);

      extensions.forEach((extension) => {
        if (extension.extendIssues) {
          issues = extension.extendIssues(issues);
        }
      });

      if (configuration.profile) {
        performance.print();
        performance.disable();
      }

      return issues;
    },
  };
}

export { createTypeScriptReporter };
