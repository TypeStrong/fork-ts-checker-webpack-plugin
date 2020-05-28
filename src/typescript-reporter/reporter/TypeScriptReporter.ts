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

function createTypeScriptReporter(configuration: TypeScriptReporterConfiguration): Reporter {
  const extensions: TypeScriptExtension[] = [];

  let system: ControlledTypeScriptSystem | undefined;
  let parsedConfiguration: ts.ParsedCommandLine | undefined;
  let watchCompilerHost:
    | ts.WatchCompilerHostOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>
    | undefined;
  let watchSolutionBuilderHost:
    | ts.SolutionBuilderWithWatchHost<ts.SemanticDiagnosticsBuilderProgram>
    | undefined;
  let watchProgram: ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram> | undefined;
  let solutionBuilder: ts.SolutionBuilder<ts.SemanticDiagnosticsBuilderProgram> | undefined;

  const diagnosticsPerProject = new Map<string, ts.Diagnostic[]>();

  if (configuration.extensions.vue.enabled) {
    extensions.push(createTypeScriptVueExtension(configuration.extensions.vue));
  }

  function getProjectNameOfBuilderProgram(builderProgram: ts.BuilderProgram): string {
    return (builderProgram.getProgram().getCompilerOptions().configFilePath as unknown) as string;
  }

  function getDiagnosticsOfBuilderProgram(builderProgram: ts.BuilderProgram) {
    const diagnostics: ts.Diagnostic[] = [];

    if (configuration.diagnosticOptions.syntactic) {
      diagnostics.push(...builderProgram.getSyntacticDiagnostics());
    }
    if (configuration.diagnosticOptions.semantic) {
      diagnostics.push(...builderProgram.getSemanticDiagnostics());
    }
    if (configuration.diagnosticOptions.declaration) {
      diagnostics.push(...builderProgram.getDeclarationDiagnostics());
    }
    if (configuration.diagnosticOptions.global) {
      diagnostics.push(...builderProgram.getGlobalDiagnostics());
    }

    return diagnostics;
  }

  return {
    getReport: async ({ changedFiles = [], deletedFiles = [] }: FilesChange) => {
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
      }

      if (!parsedConfiguration) {
        const parseConfigurationDiagnostics: ts.Diagnostic[] = [];

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
      }

      if (configuration.build) {
        // solution builder case
        // ensure watch solution builder host exists
        if (!watchSolutionBuilderHost) {
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
            },
            extensions
          );
          solutionBuilder = undefined;
        }

        // ensure solution builder exists
        if (!solutionBuilder) {
          solutionBuilder = ts.createSolutionBuilderWithWatch(
            watchSolutionBuilderHost,
            [configuration.tsconfig],
            {}
          );
          solutionBuilder.build();
        }
      } else {
        // watch compiler case
        // ensure watch compiler host exists
        if (!watchCompilerHost) {
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
            },
            extensions
          );
          watchProgram = undefined;
        }

        // ensure watch program exists
        if (!watchProgram) {
          watchProgram = ts.createWatchProgram(watchCompilerHost);
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
      await system.waitForQueued();

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

      return issues;
    },
  };
}

export { createTypeScriptReporter };
