const RpcProvider = require('worker-rpc').RpcProvider;

/**
 * this file needs to be JavaScript because it is directly required from files
 * that are injected into node using --require
 */

exports.rpcMethods = {
  nextIteration: 'checker_nextIteration',
  getKnownFileNames: 'checker_getKnownFileNames',
  getSourceFile: 'checker_getSourceFile',
  getSyntacticDiagnostics: 'checker_getSyntacticDiagnostics'
};

/** @type {RpcProvider} */
let rpc;

exports.getRpcProvider = () => {
  if (!rpc) {
    rpc = new RpcProvider(message => {
      if (process && process.send) {
        return process.send(message);
      }
    });
    process.on('message', message => rpc.dispatch(message));
  }

  return rpc;
};
