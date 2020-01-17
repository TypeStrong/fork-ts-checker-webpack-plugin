const mock = require('mock-require');
const origImport = require('../../../lib/IncrementalChecker');
const { rpcMethods, getRpcProvider } = require('../helpers/rpc');

mock('../../../lib/IncrementalChecker', {
  IncrementalChecker: class extends origImport.IncrementalChecker {
    constructor(...args) {
      super(...args);

      const rpc = getRpcProvider();

      rpc.registerRpcHandler(rpcMethods.nextIteration, () => {
        return this.nextIteration();
      });

      rpc.registerRpcHandler(rpcMethods.getKnownFileNames, () => {
        return this.programConfig.fileNames;
      });

      rpc.registerRpcHandler(rpcMethods.getSourceFile, fileName => {
        const result = this.program.getSourceFile(fileName);
        return !result ? undefined : { text: result.text };
      });

      rpc.registerRpcHandler(rpcMethods.getSyntacticDiagnostics, () => {
        const result = this.program.getSyntacticDiagnostics();
        return result.map(({ start, length, file }) => ({
          start,
          length,
          file: { text: file.text }
        }));
      });
    }
  }
});
