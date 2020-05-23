function assertTypeScriptPnpExtensionSupport() {
  try {
    // eslint-disable-next-line node/no-missing-require
    require('ts-pnp');
  } catch (error) {
    throw new Error(
      'When you use this plugin with typescript pnp extension enabled, you must install `ts-pnp`.'
    );
  }
}

export { assertTypeScriptPnpExtensionSupport };
