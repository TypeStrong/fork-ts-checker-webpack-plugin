import os from 'os';
import chalk from 'chalk';
import path from 'path';
import { Formatter } from './Formatter';
import { formatIssueLocation } from '../issue';
import forwardSlash from '../utils/path/forwardSlash';

function createWebpackFormatter(formatter: Formatter): Formatter {
  // mimics webpack error formatter
  return function webpackFormatter(issue) {
    const color = issue.severity === 'warning' ? chalk.yellow.bold : chalk.red.bold;

    const severity = issue.severity.toUpperCase();

    if (issue.file) {
      let location = forwardSlash(path.relative(process.cwd(), issue.file));
      if (issue.location) {
        location += `:${formatIssueLocation(issue.location)}`;
      }

      return [color(`${severity} in ${location}`), formatter(issue), ''].join(os.EOL);
    } else {
      return [color(`${severity} in `) + formatter(issue), ''].join(os.EOL);
    }
  };
}

export { createWebpackFormatter };
