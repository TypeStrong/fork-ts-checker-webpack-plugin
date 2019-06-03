const RpcProvider = require('worker-rpc').RpcProvider;

/**
 * this file needs to be JavaScript because it is direcly required from files that are injected into node using --require
 */

exports.rpcMethods = {
  checker_nextIteration: 'checker_nextIteration',
  checker_getKnownFileNames: 'checker_getKnownFileNames',
  checker_getSourceFile: 'checker_getSourceFile',
  checker_getSyntacticDiagnostics: 'checker_getSyntacticDiagnostics'
};

/** @type {RpcProvider} */
let rpc;
exports.getRpcProvider = () => {
  if (!rpc) {
    rpc = new RpcProvider(message =>
      // @ts-ignore
      process.send(message)
    );
    process.on('message', message => rpc.dispatch(message));
  }
  return rpc;
};
