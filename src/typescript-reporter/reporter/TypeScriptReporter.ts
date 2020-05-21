import * as ts from 'typescript';
import { FilesChange, Reporter } from '../../reporter';
import { createIssuesFromTsDiagnostics } from '../issue/TypeScriptIssueFactory';
import { TypeScriptReporterConfiguration } from '../TypeScriptReporterConfiguration';
import { createControlledWatchCompilerHost } from './ControlledWatchCompilerHost';
import { TypeScriptExtension } from '../extension/TypeScriptExtension';
import { createTypeScriptVueExtension } from '../extension/vue/TypeScriptVueExtension';
import { createTypeScriptPnpExtension } from '../extension/pnp/TypeScriptPnpExtension';
import { createControlledWatchSolutionBuilderHost } from './ControlledWatchSolutionBuilderHost';
import {
  ControlledTypeScriptSystem,
  createControlledTypeScriptSystem,
} from './ControlledTypeScriptSystem';

function createTypeScriptReporter(configuration: TypeScriptReporterConfiguration): Reporter {
  const extensions: TypeScriptExtension[] = [];

  let system: ControlledTypeScriptSystem | undefined;
  let watchCompilerHost:
    | ts.WatchCompilerHostOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>
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
  if (configuration.extensions.pnp.enabled) {
    extensions.push(createTypeScriptPnpExtension());
  }

  function getProjectNameOfBuilderProgram(builderProgram: ts.BuilderProgram): string {
    return (builderProgram.getProgram().getCompilerOptions().configFilePath as unknown) as string;
  }

  function getDiagnosticsOfBuilderProgram(builderProgram: ts.BuilderProgram) {
    const diagnostics: ts.Diagnostic[] = [];

    if (typeof builderProgram.getConfigFileParsingDiagnostics === 'function') {
      diagnostics.push(...builderProgram.getConfigFileParsingDiagnostics());
    }
    if (typeof builderProgram.getOptionsDiagnostics === 'function') {
      diagnostics.push(...builderProgram.getOptionsDiagnostics());
    }

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
        system = createControlledTypeScriptSystem();
      }

      // clear cache to be ready for next iteration and to free memory
      system.clearCache();

      if (configuration.build) {
        // solution builder case
        // ensure watch solution builder host exists
        if (!watchSolutionBuilderHost) {
          watchSolutionBuilderHost = createControlledWatchSolutionBuilderHost(
            configuration.tsconfig,
            configuration.compilerOptions as ts.CompilerOptions, // assume that these are valid ts.CompilerOptions
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
            configuration.tsconfig,
            configuration.compilerOptions as ts.CompilerOptions, // assume that these are valid ts.CompilerOptions
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
