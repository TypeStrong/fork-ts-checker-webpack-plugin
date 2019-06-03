import chalk from 'chalk';
import * as os from 'os';
import { NormalizedMessage } from '../NormalizedMessage';

/**
 * Creates new default formatter.
 *
 * @returns {defaultFormatter}
 */
export function createDefaultFormatter() {
  return function defaultFormatter(
    message: NormalizedMessage,
    useColors: boolean
  ) {
    const colors = new chalk.constructor({ enabled: useColors });
    const messageColor = message.isWarningSeverity()
      ? colors.bold.yellow
      : colors.bold.red;
    const fileAndNumberColor = colors.bold.cyan;
    const codeColor = colors.grey;

    if (message.code === NormalizedMessage.ERROR_CODE_INTERNAL) {
      return (
        messageColor(`INTERNAL ${message.severity.toUpperCase()}: `) +
        message.content +
        (message.stack
          ? os.EOL + 'stack trace:' + os.EOL + colors.gray(message.stack)
          : '')
      );
    }

    return [
      messageColor(`${message.severity.toUpperCase()} in `) +
        fileAndNumberColor(
          `${message.file}(${message.line},${message.character})`
        ) +
        messageColor(':'),
      codeColor(message.getFormattedCode() + ': ') + message.content
    ].join(os.EOL);
  };
}
