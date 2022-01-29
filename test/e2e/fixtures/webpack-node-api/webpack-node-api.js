const webpack = require('webpack');
const configuration = require('./webpack.config.js');

const builder = webpack({ ...configuration, mode: 'development' });

function run() {
  return new Promise((resolve, reject) => {
    builder.run((error, stats) => {
      if (error) {
        reject(error);
      } else {
        resolve(stats);
      }
    });
  });
}

function runAndPrint() {
  return run()
    .then((stats) => {
      const warnings = stats.compilation.warnings;
      const errors = stats.compilation.errors;

      if (warnings.length === 0 && errors.length === 0) {
        console.log('Compiled successfully.');
      } else {
        console.log('Compiled with warnings or errors.');
      }
    })
    .catch((error) => console.error(error));
}

// run build twice in sequence
runAndPrint()
  .then(() => runAndPrint())
  .then(() => console.log('Compiled successfully twice.'));
