import { Formatter } from './Formatter';
import os from 'os';
import chalk from 'chalk';

function createWebpackFormatter(formatter: Formatter): Formatter {
  return function webpackFormatter(issue) {
    const severity = issue.severity.toUpperCase();
    const file = issue.file;
    const location = issue.location
      ? [
          `${issue.location.start.line}:${issue.location.start.column}`,
          `${issue.location.end.line}:${issue.location.end.column}`,
        ].join('-')
      : undefined;
    const color = issue.severity === 'warning' ? chalk.yellow : chalk.red;
    const header = [severity, 'in', file].concat(location ? [location] : []).join(' ');

    return [color.bold(header), formatter(issue), ''].join(os.EOL);
  };
}

export { createWebpackFormatter };
