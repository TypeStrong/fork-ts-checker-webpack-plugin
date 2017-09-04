
import chalk = require('chalk');
import os = require('os');
import NormalizedMessage = require('../NormalizedMessage');

/**
 * Creates new default formatter.
 *
 * @returns {defaultFormatter}
 */
export = function createDefaultFormatter() {
  return function defaultFormatter(message: NormalizedMessage, useColors: boolean) {
    const colors = new chalk.constructor({enabled: useColors});
    const messageColor = message.isWarningSeverity() ? colors.bold.yellow : colors.bold.red;
    const numberColor = colors.bold.cyan;
    const codeColor = colors.grey;

    return [
      messageColor(message.getSeverity().toUpperCase() + ' at ' + message.getFile()) +
      '(' + numberColor(`${message.getLine()}`) + ',' + numberColor(`${message.getCharacter()}`) + '): ',
      codeColor(message.getFormattedCode() + ': ') + message.getContent()
    ].join(os.EOL);
  };
};
