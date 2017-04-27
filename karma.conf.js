module.exports = function (config) {
  config.set({
    browsers: ['PhantomJS'],
    singleRun: true,
    colors: true,
    frameworks: ['mocha', 'chai'],
    files: [
      'lib/**/*.js',
      'test/**/*.spec.js'
    ],
    reporters: ['dots'],
    karmaTypescriptConfig: {
      reports: {
        'lcovonly': {
          'directory': 'coverage',
          'subdirectory': 'lcov',
          'filename': 'lcov.info'
        },
        'html': {
          'directory': 'coverage',
          'subdirectory': 'html',
          'filename': '.'
        },
        'text': ''
      }
    }
  });
};
