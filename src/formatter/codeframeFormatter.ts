import os = require('os');
import codeFrame = require('babel-code-frame');
import fs = require('fs');
import NormalizedMessage = require('../NormalizedMessage');
import createDefaultFormatter = require('./defaultFormatter');

/**
 * Create new code frame formatter.
 *
 * @param useGnuStandardLines Use GNU standard error line format - see https://github.com/Microsoft/TypeScript/issues/14482
 * @param options Options for babel-code-frame - see https://www.npmjs.com/package/babel-code-frame
 * @returns {codeframeFormatter}
 */
export = function createCodeframeFormatter(options: any, useGnuStandardLines = false) {
  function codeframeFormatter(message: NormalizedMessage, useColors: boolean) {
    const source = message.getFile() && fs.existsSync(message.getFile()) && fs.readFileSync(message.getFile(), 'utf-8');
    let frame;

    if (source) {
      frame = codeFrame(
        source,
        message.line,
        message.character,
        Object.assign({}, options || {}, { highlightCode: useColors })
      )
      .split('\n')
      .map(str => '  ' + str)
      .join(os.EOL);
    }

    return frame ? frame + os.EOL : '';
  }

  return createDefaultFormatter(useGnuStandardLines, codeframeFormatter);
};
