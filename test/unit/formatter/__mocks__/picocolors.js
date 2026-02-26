// picocolors mock - bypass all styling for deterministic test output
function identity(str) {
  return String(str);
}

const colors = {
  isColorSupported: false,
  reset: identity,
  bold: identity,
  dim: identity,
  italic: identity,
  underline: identity,
  inverse: identity,
  hidden: identity,
  strikethrough: identity,
  black: identity,
  red: identity,
  green: identity,
  yellow: identity,
  blue: identity,
  magenta: identity,
  cyan: identity,
  white: identity,
  gray: identity,
  bgBlack: identity,
  bgRed: identity,
  bgGreen: identity,
  bgYellow: identity,
  bgBlue: identity,
  bgMagenta: identity,
  bgCyan: identity,
  bgWhite: identity,
  createColors: () => colors,
};

colors.default = colors;

module.exports = colors;
