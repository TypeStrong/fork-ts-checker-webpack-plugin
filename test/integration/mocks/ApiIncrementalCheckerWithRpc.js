const mock = require('mock-require');

const origImport = require('../../../lib/ApiIncrementalChecker');
const { rpcMethods, getRpcProvider } = require('../helpers');

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

      rpc.registerRpcHandler(rpcMethods.checker_nextIteration, () => {
        return this.nextIteration();
      });

      rpc.registerRpcHandler(rpcMethods.checker_getKnownFileNames, async () => {
        await awaitInit();
        return Array.from(this.tsIncrementalCompiler.getAllKnownFiles());
      });

      rpc.registerRpcHandler(
        rpcMethods.checker_getSourceFile,
        async fileName => {
          await awaitInit();
          const result = this.tsIncrementalCompiler
            .getProgram()
            .getSourceFile(fileName);
          return !result ? undefined : { text: result.text };
        }
      );

      rpc.registerRpcHandler(
        rpcMethods.checker_getSyntacticDiagnostics,
        async () => {
          await awaitInit();
          const result = this.tsIncrementalCompiler
            .getProgram()
            .getSyntacticDiagnostics();
          return result.map(({ start, length, file }) => ({
            start,
            length,
            file: { text: file.text }
          }));
        }
      );
    }
  }
});
