// Removes ANSI escape codes from a string
// eslint-disable-next-line no-control-regex
export const stripAnsi = (text: string) => text.replace(/\u001b[^m]*?m/g, '');
