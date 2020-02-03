import * as ts from 'typescript';
import { FilesChange, Reporter } from '../../reporter';
import { createIssuesFromTsDiagnostics } from '../issue/TypeScriptIssueFactory';
import { TypeScriptReporterConfiguration } from '../TypeScriptReporterConfiguration';
import { createControlledWatchCompilerHost } from './ControlledWatchCompilerHost';
import { TypeScriptExtension } from '../extension/TypeScriptExtension';
import { createTypeScriptReporterState, TypeScriptReporterState } from './TypeScriptReporterState';
import { createTypeScriptVueExtension } from '../extension/vue/TypeScriptVueExtension';
import { createTypeScriptPnpExtension } from '../extension/pnp/TypeScriptPnpExtension';
import { createControlledWatchSolutionBuilderHost } from './ControlledWatchSolutionBuilderHost';
import { ControlledWatchHost } from './ControlledWatchHost';

function createTypeScriptReporter(configuration: TypeScriptReporterConfiguration): Reporter {
  const extensions: TypeScriptExtension[] = [];
  const state: TypeScriptReporterState = createTypeScriptReporterState();

  if (configuration.extensions.vue.enabled) {
    extensions.push(createTypeScriptVueExtension(configuration.extensions.vue));
  }
  if (configuration.extensions.pnp.enabled) {
    extensions.push(createTypeScriptPnpExtension());
  }

  function getProjectNameOfBuilderProgram(builderProgram: ts.BuilderProgram): string {
    // TODO: it's not a public API - ensure support on different TypeScript versions
    return (builderProgram.getProgram().getCompilerOptions().configFilePath as unknown) as string;
  }

  function getDiagnosticsOfBuilderProgram(builderProgram: ts.BuilderProgram) {
    const diagnostics: ts.Diagnostic[] = [];

    diagnostics.push(...builderProgram.getConfigFileParsingDiagnostics());
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

  async function invokeFilesChangeOnControlledHost(
    controlledHost: ControlledWatchHost,
    { createdFiles = [], changedFiles = [], deletedFiles = [] }: FilesChange
  ) {
    createdFiles.forEach((createdFile) => {
      controlledHost.invokeFileCreated(createdFile);
    });
    changedFiles.forEach((changedFile) => {
      controlledHost.invokeFileChanged(changedFile);
    });
    deletedFiles.forEach((removedFile) => {
      controlledHost.invokeFileDeleted(removedFile);
    });

    // wait for watch events to be propagated
    await new Promise((resolve) => setImmediate(resolve));
  }

  return {
    getReport: async (filesChange) => {
      if (configuration.build) {
        // solution builder case
        // ensure watch solution builder host exists
        if (!state.watchSolutionBuilderHost) {
          state.watchSolutionBuilderHost = createControlledWatchSolutionBuilderHost(
            configuration.tsconfig,
            configuration.compilerOptions as ts.CompilerOptions, // assume that these are valid ts.CompilerOptions
            ts.sys,
            ts.createSemanticDiagnosticsBuilderProgram,
            undefined,
            undefined,
            undefined,
            undefined,
            (builderProgram) => {
              const projectName = getProjectNameOfBuilderProgram(builderProgram);
              const diagnostics = getDiagnosticsOfBuilderProgram(builderProgram);

              // update diagnostics
              state.diagnosticsPreProject[projectName] = diagnostics;
            },
            extensions
          );
          state.solutionBuilder = undefined;
        }

        // ensure solution builder exists
        if (!state.solutionBuilder) {
          state.solutionBuilder = ts.createSolutionBuilderWithWatch(
            state.watchSolutionBuilderHost,
            [configuration.tsconfig],
            {
              incremental: true,
              verbose: true,
            }
          );
          state.solutionBuilder.build();
        }

        // invoke files changes on the host
        await invokeFilesChangeOnControlledHost(state.watchSolutionBuilderHost, filesChange);

        // await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        // watch compiler case
        // ensure watch compiler host exists
        if (!state.watchCompilerHost) {
          state.watchCompilerHost = createControlledWatchCompilerHost(
            configuration.tsconfig,
            configuration.compilerOptions as ts.CompilerOptions, // assume that these are valid ts.CompilerOptions
            ts.sys,
            ts.createSemanticDiagnosticsBuilderProgram,
            undefined,
            undefined,
            (builderProgram) => {
              const projectName = getProjectNameOfBuilderProgram(builderProgram);
              const diagnostics = getDiagnosticsOfBuilderProgram(builderProgram);

              // update diagnostics
              state.diagnosticsPreProject[projectName] = diagnostics;
            },
            extensions
          );
          state.watchProgram = undefined;
        }

        // ensure watch program exists
        if (!state.watchProgram) {
          state.watchProgram = ts.createWatchProgram(state.watchCompilerHost);
        }

        // invoke files changes on the host
        await invokeFilesChangeOnControlledHost(state.watchCompilerHost, filesChange);
      }

      // aggregate all diagnostics and map them to issues
      const diagnostics = Object.keys(state.diagnosticsPreProject).reduce<ts.Diagnostic[]>(
        (allDiagnostics, project) => [...allDiagnostics, ...state.diagnosticsPreProject[project]],
        []
      );
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
