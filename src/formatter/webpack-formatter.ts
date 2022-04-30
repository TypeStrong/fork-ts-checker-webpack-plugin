import os from 'os';

import chalk from 'chalk';

import { formatIssueLocation } from '../issue';
import { relativeToContext } from '../utils/path/relative-to-context';

import type { Formatter } from './formatter';

function createWebpackFormatter(formatter: Formatter): Formatter {
  // mimics webpack error formatter
  return function webpackFormatter(issue) {
    const color = issue.severity === 'warning' ? chalk.yellow.bold : chalk.red.bold;

    const severity = issue.severity.toUpperCase();

    if (issue.file) {
      let location = chalk.bold(relativeToContext(issue.file, process.cwd()));
      if (issue.location) {
        location += ` ${chalk.green.bold(formatIssueLocation(issue.location))}`;
      }

      return [`${color(severity)} in ${location}`, formatter(issue), ''].join(os.EOL);
    } else {
      return [`${color(severity)} in ` + formatter(issue), ''].join(os.EOL);
    }
  };
}

export { createWebpackFormatter };
