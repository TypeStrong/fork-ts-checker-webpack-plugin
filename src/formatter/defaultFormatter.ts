import chalk = require('chalk');
import os = require('os');
import NormalizedMessage = require('../NormalizedMessage');

/**
 * Creates new default formatter.
 *
 * @param useGnuStandardLines Use GNU standard error line format - see https://github.com/Microsoft/TypeScript/issues/14482
 * @param extension Extension formatter used to display additional info after default lines
 * @returns {defaultFormatter}
 */
export = function createDefaultFormatter(useGnuStandardLines = false, extension?: (message: NormalizedMessage, useColors: boolean) => string) {
  return function defaultFormatter(message: NormalizedMessage, useColors: boolean) {
    const colors = new chalk.constructor({enabled: useColors});
    const messageColor = message.isWarningSeverity() ? colors.bold.yellow : colors.bold.red;
    const fileColor = colors.bold.cyan;
    const positionColor = colors.dim;
    const codeColor = messageColor.dim;

    const position = useGnuStandardLines
      ? `:${message.getLine()}:${message.getCharacter()}`
      : `(${message.getLine()},${message.getCharacter()}):`;

    const fileLine = [
      messageColor(`${message.getSeverity().toUpperCase()} in `),
      fileColor(message.getFile()),
      positionColor(position)
    ].join('');

    const messageLine = codeColor(message.getFormattedCode() + ': ') + messageColor(message.getContent());

    return [
      fileLine,
      messageLine,
      extension ? extension(message, useColors) : ''
    ].join(os.EOL);
  };
};
