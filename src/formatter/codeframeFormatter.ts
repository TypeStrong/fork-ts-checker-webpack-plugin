import * as os from 'os';
import codeFrame = require('babel-code-frame');
import chalk from 'chalk';
import * as fs from 'fs';
import { NormalizedMessage } from '../NormalizedMessage';
import { FsHelper } from '../FsHelper';

/**
 * Create new code frame formatter.
 *
 * @param options Options for babel-code-frame - see https://www.npmjs.com/package/babel-code-frame
 * @returns {codeframeFormatter}
 */
export function createCodeframeFormatter(options: any) {
  return function codeframeFormatter(
    message: NormalizedMessage,
    useColors: boolean
  ) {
    const colors = new chalk.constructor({ enabled: useColors });
    const messageColor = message.isWarningSeverity()
      ? colors.bold.yellow
      : colors.bold.red;
    const positionColor = colors.dim;

    const file = message.file;
    const source =
      file && FsHelper.existsSync(file) && fs.readFileSync(file, 'utf-8');
    let frame = '';

    if (source) {
      frame = codeFrame(
        source,
        message.line!, // Assertion: `codeFrame` allows passing undefined, typings are incorrect
        message.character!,
        Object.assign({}, options || {}, { highlightCode: useColors })
      )
        .split('\n')
        .map(str => '  ' + str)
        .join(os.EOL);
    }

    return (
      messageColor(message.severity.toUpperCase() + ' in ' + message.file) +
      os.EOL +
      positionColor(message.line + ':' + message.character) +
      ' ' +
      message.content +
      (frame ? os.EOL + frame : '')
    );
  };
}
