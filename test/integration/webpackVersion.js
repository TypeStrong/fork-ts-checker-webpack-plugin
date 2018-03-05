function getWebpackMajorVersion() {
  // Determine major webpack version from package.json
  var packageJson = require('../../package.json');
  var webpackVersion = packageJson.devDependencies.webpack.replace(
    /[^0-9.]/g,
    ''
  );
  var webpackMajorVersion = parseInt(webpackVersion.split('.')[0], 10);
  return webpackMajorVersion;
}

module.exports = getWebpackMajorVersion;
