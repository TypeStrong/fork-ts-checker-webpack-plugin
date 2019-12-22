import * as mock from 'mock-require';
import * as origImport from '../../../lib/ApiIncrementalChecker';
import { rpcMethods, getRpcProvider } from '../helpers/rpc';

mock('../../../lib/ApiIncrementalChecker', {
  ApiIncrementalChecker: class extends origImport.ApiIncrementalChecker {
    constructor(...args) {
      super(...args);

      const rpc = getRpcProvider();

      const awaitInit = async () => {
        if (!this.tsIncrementalCompiler.lastProcessing) {
          await this.tsIncrementalCompiler.processChanges();
        } else {
          await this.tsIncrementalCompiler.lastProcessing;
        }
      };

      rpc.registerRpcHandler(rpcMethods.nextIteration, () => {
        return this.nextIteration();
      });

      rpc.registerRpcHandler(rpcMethods.getKnownFileNames, async () => {
        await awaitInit();
        return Array.from(this.tsIncrementalCompiler.getAllKnownFiles());
      });

      rpc.registerRpcHandler(rpcMethods.getSourceFile, async fileName => {
        await awaitInit();
        const result = this.tsIncrementalCompiler
          .getProgram()
          .getSourceFile(fileName);
        return !result ? undefined : { text: result.text };
      });

      rpc.registerRpcHandler(rpcMethods.getSyntacticDiagnostics, async () => {
        await awaitInit();
        const result = this.tsIncrementalCompiler
          .getProgram()
          .getSyntacticDiagnostics();
        return result.map(({ start, length, file }) => ({
          start,
          length,
          file: { text: file.text }
        }));
      });
    }
  }
});
