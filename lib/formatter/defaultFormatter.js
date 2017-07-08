
var chalk = require('chalk');
var os = require('os');

/**
 * Creates new default formatter.
 *
 * @returns {defaultFormatter}
 */
module.exports = function createDefaultFormatter() {
  return function defaultFormatter(message, useColors) {
    var colors = new chalk.constructor({enabled: useColors});
    var messageColor = message.isWarningSeverity() ? colors.bold.yellow : colors.bold.red;
    var numberColor = colors.bold.cyan;
    var codeColor = colors.grey;

    return [
      messageColor(message.getSeverity().toUpperCase() + ' at ' + message.getFile()) +
      '(' + numberColor(message.getLine()) + ',' + numberColor(message.getCharacter()) + '): ',
      codeColor(message.getFormattedCode() + ': ') + message.getContent()
    ].join(os.EOL);
  };
};
