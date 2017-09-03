
import chalk = require('chalk');
import os = require('os');

/**
 * Creates new default formatter.
 *
 * @returns {defaultFormatter}
 */
export = function createDefaultFormatter() {
  return function defaultFormatter(message, useColors) {
    const colors = new chalk.constructor({enabled: useColors});
    const messageColor = message.isWarningSeverity() ? colors.bold.yellow : colors.bold.red;
    const numberColor = colors.bold.cyan;
    const codeColor = colors.grey;

    return [
      messageColor(message.getSeverity().toUpperCase() + ' at ' + message.getFile()) +
      '(' + numberColor(message.getLine()) + ',' + numberColor(message.getCharacter()) + '): ',
      codeColor(message.getFormattedCode() + ': ') + message.getContent()
    ].join(os.EOL);
  };
};
