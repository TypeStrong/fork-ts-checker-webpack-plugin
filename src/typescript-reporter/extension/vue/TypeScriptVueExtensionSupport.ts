import { TypeScriptVueExtensionConfiguration } from './TypeScriptVueExtensionConfiguration';

function assertTypeScriptVueExtensionSupport(configuration: TypeScriptVueExtensionConfiguration) {
  // We need to import template compiler for vue lazily because it cannot be included it
  // as direct dependency because it is an optional dependency of fork-ts-checker-webpack-plugin.
  // Since its version must not mismatch with user-installed Vue.js,
  // we should let the users install template compiler for vue by themselves.
  const compilerName = configuration.compiler;

  try {
    require(compilerName);
  } catch (err) {
    throw new Error('When you use `vue` option, make sure to install `' + compilerName + '`.');
  }
}

export { assertTypeScriptVueExtensionSupport };
