// tslint:disable:no-implicit-dependencies
function getWebpackMajorVersion() {
  // Determine major webpack version from package.json or webpack itself
  const rawWebpackVersion =
    require('webpack').version ||
    require('../../../package.json').devDependencies.webpack;
  const webpackVersion = rawWebpackVersion.replace(/[^0-9.]/g, '');
  return parseInt(webpackVersion.split('.')[0], 10);
}

export const webpackMajorVersion = getWebpackMajorVersion();
