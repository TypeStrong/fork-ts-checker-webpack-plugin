import * as fs from 'fs';
import * as path from 'path';

import type {
  CreateSnapshotParams,
  Diagnostic,
  FileNotifications,
  Program,
  Snapshot,
  SyntheticProjectId,
} from 'typescript/async';

import type { FilesChange } from '../../files-change';
import type { TypeScriptWorkerConfig } from '../type-script-worker-config';

import type { ApiHost } from './api';
import type { ConfigStore } from './config';
import { getDiagnosticsOfProgram } from './diagnostics';
import type { TypeScriptModules } from './typescript';

export interface ProgramHost {
  /** Updates the program with the changes and returns its diagnostics. */
  useProgram(change: FilesChange): Promise<Diagnostic[]>;
  invalidateProgram(): void;
  invalidateProgramRootFileNames(): void;
  /** Forgets the program without talking to the compiler, which may be gone. */
  resetProgram(): void;
}

function getFileNotifications({
  changedFiles = [],
  deletedFiles = [],
}: FilesChange): FileNotifications | undefined {
  if (changedFiles.length === 0 && deletedFiles.length === 0) {
    return undefined;
  }

  // webpack's watcher doesn't distinguish created from changed files
  return {
    changed: changedFiles.map((file) => path.resolve(file)),
    deleted: deletedFiles.map((file) => path.resolve(file)),
  };
}

export function createProgramHost(
  config: TypeScriptWorkerConfig,
  { typescriptAsync }: TypeScriptModules,
  { getApi }: ApiHost,
  { getParsedConfig }: ConfigStore
): ProgramHost {
  let snapshot: Snapshot | undefined;
  let programId: SyntheticProjectId | undefined;
  let shouldReconfigureProgram = false;
  let didConfigChange = false;

  async function getProgramParams() {
    const parsedConfig = await getParsedConfig();

    return {
      rootFiles: parsedConfig.fileNames,
      compilerOptions: parsedConfig.options,
      options: {
        projectReferences: parsedConfig.projectReferences,
      },
    };
  }

  async function updateSnapshot(params: CreateSnapshotParams): Promise<Snapshot> {
    const previousSnapshot = snapshot;
    // each snapshot must be derived from the previous one to keep the API's cache
    const nextSnapshot = previousSnapshot
      ? await previousSnapshot.update(params)
      : await getApi().createSnapshot(params);
    await previousSnapshot?.dispose();
    snapshot = nextSnapshot;

    return nextSnapshot;
  }

  /**
   * Writes the program's .d.ts files, skipping unchanged ones: the program re-emits
   * every file each time, and rewriting them all would trigger more watch events.
   */
  async function emitDeclarations(program: Program): Promise<readonly Diagnostic[]> {
    // `configOverwrite` can turn `emitDeclarationOnly` off, so don't rely on it
    const { diagnostics, outputFiles } = await program.emitToString(
      typescriptAsync.EmitOnly.OnlyDts
    );

    for (const [fileName, { text }] of outputFiles) {
      let previousText: string | undefined;
      try {
        previousText = await fs.promises.readFile(fileName, 'utf8');
      } catch (error) {
        // not written yet
      }
      if (previousText !== text) {
        await fs.promises.mkdir(path.dirname(fileName), { recursive: true });
        await fs.promises.writeFile(fileName, text);
      }
    }

    return diagnostics;
  }

  async function useProgram(change: FilesChange): Promise<Diagnostic[]> {
    const fileNotifications = getFileNotifications(change);

    if (programId === undefined) {
      const nextSnapshot = await updateSnapshot({ createPrograms: [await getProgramParams()] });
      programId = nextSnapshot.operation.createdPrograms![0].id;
    } else {
      await updateSnapshot({
        // a config change can affect how any file is read, so start afresh
        fileNotifications: didConfigChange ? { invalidateAll: true } : fileNotifications,
        // reconfigure in place: `removePrograms` + `createPrograms` in a single
        // update crashes the 7.1 beta compiler process
        reconfigurePrograms:
          shouldReconfigureProgram || didConfigChange
            ? [{ id: programId, ...(await getProgramParams()) }]
            : undefined,
        // without it, a synthetic program keeps the old contents of changed files
        ensurePrograms: true,
      });
    }
    shouldReconfigureProgram = false;
    didConfigChange = false;

    const program = snapshot!.getProgram(programId);
    if (!program) {
      throw new Error('TypeScript program is missing from the snapshot.');
    }

    const diagnostics = await getDiagnosticsOfProgram(program, config.diagnosticOptions);
    // `configOverwrite` can turn `declaration` off, as with `tsc`
    if (config.mode === 'write-dts' && (await getParsedConfig()).options.declaration) {
      diagnostics.push(...(await emitDeclarations(program)));
    }

    return diagnostics;
  }

  function invalidateProgram() {
    didConfigChange = true;
  }

  function invalidateProgramRootFileNames() {
    shouldReconfigureProgram = true;
  }

  function resetProgram() {
    snapshot = undefined;
    programId = undefined;
    shouldReconfigureProgram = false;
    didConfigChange = false;
  }

  return { useProgram, invalidateProgram, invalidateProgramRootFileNames, resetProgram };
}
