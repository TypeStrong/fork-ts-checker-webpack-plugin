import * as os from 'os';
import codeFrame = require('babel-code-frame');
import chalk from 'chalk';
import * as fs from 'fs';
import { NormalizedMessage } from '../NormalizedMessage';

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

    const source =
      message.getFile() &&
      fs.existsSync(message.getFile()) &&
      fs.readFileSync(message.getFile(), 'utf-8');
    let frame = '';

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

    return (
      messageColor(
        message.getSeverity().toUpperCase() + ' in ' + message.getFile()
      ) +
      os.EOL +
      positionColor(message.getLine() + ':' + message.getCharacter()) +
      ' ' +
      message.getContent() +
      (frame ? os.EOL + frame : '')
    );
  };
}
