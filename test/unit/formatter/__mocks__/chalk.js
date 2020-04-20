function style(...strings) {
  // by-pass styling
  return strings.join(' ');
}

const modifiers = [
  'reset',
  'bold',
  'dim',
  'italic',
  'underline',
  'inverse',
  'hidden',
  'strikethrough',
  'visible',
];
const colors = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'blackBright',
  'gray',
  'grey',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
];
const bgColors = [
  'bgBlack',
  'bgRed',
  'bgGreen',
  'bgYellow',
  'bgBlue',
  'bgMagenta',
  'bgCyan',
  'bgWhite',
  'bgBlackBright',
  'bgGray',
  'bgGrey',
  'bgRedBright',
  'bgGreenBright',
  'bgYellowBright',
  'bgBlueBright',
  'bgMagentaBright',
  'bgCyanBright',
  'bgWhiteBright',
];
const models = ['rgb', 'hex', 'keyword', 'hsl', 'hsv', 'hwb', 'ansi', 'ansi256'];

const styleMethods = [...modifiers, ...colors, ...bgColors];
const modelMethods = models;

// register all style methods as a chain methods
styleMethods.forEach((method) => {
  style[method] = style;
});
// register all model methods as a chain methods
modelMethods.forEach((method) => {
  style[method] = () => style;
});

// chalk constructor
function Chalk() {
  // chalk API
  this.supportsColor = {
    level: 0,
    hasBasic: false,
    has256: false,
    has16m: false,
  };

  // register all style methods as a chalk API
  styleMethods.forEach((method) => {
    this[method] = style;
  });
  // register all model methods as a chalk API
  modelMethods.forEach((method) => {
    this[method] = () => style;
  });
}

// default chalk instance
const chalk = new Chalk();
chalk.stderr = new Chalk();
chalk.Instance = Chalk;

// mimic chalk export style
chalk.default = chalk;
module.exports = chalk;
