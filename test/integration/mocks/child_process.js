var mockRequire = require('mock-require');

module.exports = {
  fork(modulePath, args, options) {
    const stringEnv = options.env;
    for (const key of Object.keys(stringEnv)) {
      stringEnv[key] =
        typeof stringEnv[key] === 'string'
          ? stringEnv[key]
          : JSON.stringify(stringEnv[key]);
    }
    Object.assign(process.env, options.env, { RUNNING_IN_TEST: 'true' });

    const webpackToServiceCallbacks = { message: [], SIGINT: [] };
    const serviceToWebpackCallbacks = { message: [], exit: [] };
    const applyCallbacks = (queues, event, ...args) =>
      (queues[event] || []).forEach(cb => cb(...args));
    const registerCallbacks = (queues, event, cb) =>
      (queues[event] = [...(queues[event] || []), cb]);

    process.on = (event, callback) =>
      registerCallbacks(webpackToServiceCallbacks, event, callback);
    process.send = message =>
      applyCallbacks(serviceToWebpackCallbacks, 'message', message);
    process.exit = code =>
      applyCallbacks(serviceToWebpackCallbacks, 'exit', JSON.stringify(code));

    mockRequire.reRequire(modulePath);

    const ret = {
      on(event, callback) {
        registerCallbacks(serviceToWebpackCallbacks, event, callback);
      },
      send(cancellationToken) {
        applyCallbacks(
          webpackToServiceCallbacks,
          'message',
          JSON.stringify(cancellationToken.toJSON())
        );
      },
      connected: true,
      kill() {
        applyCallbacks(webpackToServiceCallbacks, 'SIGINT', '0');
        ret.connected = false;
      }
    };

    return ret;
  }
};
