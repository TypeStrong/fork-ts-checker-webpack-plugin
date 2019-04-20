import { CancellationTokenData } from './CancellationToken';
import { Message } from './Message';
// tslint:disable-next-line:no-implicit-dependencies
import { SourceFile, DiagnosticWithLocation } from 'typescript'; // import for types alone

export enum RPC {
  RUN = 'run',
  GET_KNOWN_FILE_NAMES = 'getKnownFileNames',
  GET_SOURCE_FILE = 'getSourceFile',
  GET_SYNTACTIC_DIAGNOSTICS = 'getSyntacticDiagnostics',
  NEXT_ITERATION = 'nextIteration'
}

export type Payload<T extends RPC> =
  //
  T extends RPC.RUN
    ? CancellationTokenData
    : T extends RPC.GET_KNOWN_FILE_NAMES
    ? undefined
    : T extends RPC.GET_SOURCE_FILE
    ? string
    : T extends RPC.GET_SYNTACTIC_DIAGNOSTICS
    ? undefined
    : T extends RPC.NEXT_ITERATION
    ? undefined
    : never;

export type Result<T extends RPC> =
  //
  T extends RPC.RUN
    ? Message | undefined // when run was cancelled via CancellationToken, undefined is returned
    : T extends RPC.GET_KNOWN_FILE_NAMES
    ? string[]
    : T extends RPC.GET_SOURCE_FILE
    ? Pick<SourceFile, 'text'> | undefined
    : T extends RPC.GET_SYNTACTIC_DIAGNOSTICS
    ? ReadonlyArray<Pick<DiagnosticWithLocation, 'start' | 'length'>>
    : T extends RPC.NEXT_ITERATION
    ? void
    : never;

export const RUN = 'run';
export type RunPayload = CancellationTokenData;
export type RunResult =
  | Message
  // when run was cancelled via CancellationToken, undefined is returned
  | undefined;
