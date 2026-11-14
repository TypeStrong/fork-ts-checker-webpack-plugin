const { createColors } = jest.requireActual('picocolors');

// by-pass styling in the formatters - @babel/code-frame creates its own colors
module.exports = { ...createColors(false), createColors };
