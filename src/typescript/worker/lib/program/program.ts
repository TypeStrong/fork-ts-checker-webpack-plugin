import * as path from 'path';

import type {
  CreateSnapshotParams,
  FileNotifications,
  Snapshot,
  SyntheticProjectId,
} from 'typescript/sync';

import type { FilesChange } from '../../../../files-change';
import { getApi } from '../api';
import { getParsedConfig } from '../config';
import { updateDiagnostics, getDiagnosticsOfProgram } from '../diagnostics';
import { config } from '../worker-config';

let snapshot: Snapshot | undefined;
let programId: SyntheticProjectId | undefined;
let shouldReconfigureProgram = false;
let didConfigChange = false;

function getProgramParams() {
  const parsedConfig = getParsedConfig();

  return {
    rootFiles: parsedConfig.fileNames,
    compilerOptions: parsedConfig.options,
    options: {
      projectReferences: parsedConfig.projectReferences,
    },
  };
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

function updateSnapshot(params: CreateSnapshotParams): Snapshot {
  const previousSnapshot = snapshot;
  // each snapshot must be derived from the previous one to keep the API's cache
  const nextSnapshot = previousSnapshot
    ? previousSnapshot.update(params)
    : getApi().createSnapshot(params);
  previousSnapshot?.dispose();
  snapshot = nextSnapshot;

  return nextSnapshot;
}

export function useProgram(change: FilesChange) {
  const fileNotifications = getFileNotifications(change);

  if (programId === undefined) {
    const nextSnapshot = updateSnapshot({ createPrograms: [getProgramParams()] });
    programId = nextSnapshot.operation.createdPrograms![0].id;
  } else {
    updateSnapshot({
      // a config change can affect how any file is read, so start afresh
      fileNotifications: didConfigChange ? { invalidateAll: true } : fileNotifications,
      // reconfigure in place: `removePrograms` + `createPrograms` in a single
      // update crashes the 7.1 beta compiler process
      reconfigurePrograms:
        shouldReconfigureProgram || didConfigChange
          ? [{ id: programId, ...getProgramParams() }]
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

  updateDiagnostics(config.configFile, getDiagnosticsOfProgram(program));

  if (config.mode === 'write-dts') {
    // `emitDeclarationOnly` is forced by the implicit config overwrite
    program.emit();
  }
}

export function invalidateProgram() {
  didConfigChange = true;
}

export function invalidateProgramRootFileNames() {
  shouldReconfigureProgram = true;
}

/** Forgets the program without talking to the compiler, which may be gone. */
export function resetProgram() {
  snapshot = undefined;
  programId = undefined;
  shouldReconfigureProgram = false;
  didConfigChange = false;
}
