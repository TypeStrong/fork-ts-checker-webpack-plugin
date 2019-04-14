import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { RpcProvider } from 'worker-rpc';
import { ApiIncrementalChecker } from './ApiIncrementalChecker';
import { IncrementalChecker } from './IncrementalChecker';
import { Result, RPC, Payload } from './RpcTypes';

export function initTestRpc({
  rpc,
  checker
}: {
  checker: IncrementalCheckerInterface;
  rpc: RpcProvider;
}) {
  async function nextIteration() {
    checker.nextIteration();
  }

  async function awaitInit() {
    if (checker instanceof ApiIncrementalChecker) {
      if (!checker.tsIncrementalCompiler.lastProcessing) {
        await checker.tsIncrementalCompiler.processChanges();
      } else {
        await checker.tsIncrementalCompiler.lastProcessing;
      }
    }
  }

  async function getKnownFileNames() {
    await awaitInit();
    if (checker instanceof ApiIncrementalChecker) {
      return Array.from(checker.tsIncrementalCompiler.getAllKnownFiles());
    } else if (checker instanceof IncrementalChecker) {
      return checker.programConfig!.fileNames;
    }
    throw new Error('not implemented');
  }

  async function getProgram() {
    await awaitInit();
    if (checker instanceof ApiIncrementalChecker) {
      return checker.tsIncrementalCompiler.getProgram();
    } else if (checker instanceof IncrementalChecker) {
      return checker.program!;
    }
    throw new Error('not implemented');
  }

  async function getSourceFile(fileName?: string) {
    const result = (await getProgram()).getSourceFile(fileName!);
    return !result ? undefined : { text: result.text };
  }

  async function getSyntacticDiagnostics() {
    const result = (await getProgram()).getSyntacticDiagnostics();
    return result.map(({ start, length, file }) => ({
      start,
      length,
      file: { text: file.text }
    }));
  }

  rpc.registerRpcHandler<
    Payload<RPC.NEXT_ITERATION>,
    Result<RPC.NEXT_ITERATION>
  >(RPC.NEXT_ITERATION, nextIteration);

  rpc.registerRpcHandler<
    Payload<RPC.GET_KNOWN_FILE_NAMES>,
    Result<RPC.GET_KNOWN_FILE_NAMES>
  >(RPC.GET_KNOWN_FILE_NAMES, getKnownFileNames);

  rpc.registerRpcHandler<
    Payload<RPC.GET_SOURCE_FILE>,
    Result<RPC.GET_SOURCE_FILE>
  >(RPC.GET_SOURCE_FILE, getSourceFile);

  rpc.registerRpcHandler<
    Payload<RPC.GET_SYNTACTIC_DIAGNOSTICS>,
    Result<RPC.GET_SYNTACTIC_DIAGNOSTICS>
  >(RPC.GET_SYNTACTIC_DIAGNOSTICS, getSyntacticDiagnostics);
}
