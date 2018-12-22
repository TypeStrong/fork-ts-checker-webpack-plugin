function getWebpackMajorVersion() {
  // Determine major webpack version from package.json or webpack itself
  var rawWebpackVersion =
    require('webpack').version ||
    require('../../package.json').devDependencies.webpack;
  var webpackVersion = rawWebpackVersion.replace(/[^0-9.]/g, '');
  var webpackMajorVersion = parseInt(webpackVersion.split('.')[0], 10);
  return webpackMajorVersion;
}

module.exports = getWebpackMajorVersion;
