const mock = require('mock-require');
const origImport = require('../../../lib/ApiIncrementalChecker');
const { rpcMethods, getRpcProvider } = require('../helpers/rpc');

mock('../../../lib/ApiIncrementalChecker', {
  ApiIncrementalChecker: class extends origImport.ApiIncrementalChecker {
    constructor(...args) {
      super(...args);

      const rpc = getRpcProvider();

      const init = () => {
        return (
          this.tsIncrementalCompiler.lastProcessing ||
          this.tsIncrementalCompiler.processChanges()
        );
      };

      rpc.registerRpcHandler(rpcMethods.nextIteration, () => {
        return this.nextIteration();
      });

      rpc.registerRpcHandler(rpcMethods.getKnownFileNames, () => {
        return init().then(() =>
          Array.from(this.tsIncrementalCompiler.getAllKnownFiles())
        );
      });

      rpc.registerRpcHandler(rpcMethods.getSourceFile, fileName => {
        return init().then(() => {
          const result = this.tsIncrementalCompiler
            .getProgram()
            .getSourceFile(fileName);

          return !result ? undefined : { text: result.text };
        });
      });

      rpc.registerRpcHandler(rpcMethods.getSyntacticDiagnostics, () => {
        return init().then(() => {
          const result = this.tsIncrementalCompiler
            .getProgram()
            .getSyntacticDiagnostics();
          return result.map(({ start, length, file }) => ({
            start,
            length,
            file: { text: file.text }
          }));
        });
      });
    }
  }
});
