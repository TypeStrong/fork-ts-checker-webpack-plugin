import os from 'os';

import chalk from 'chalk';

import { formatIssueLocation } from '../issue';
import { formatFilePath } from '../utils/path/format-file-path';

import type { Formatter, FormatterPathType } from './formatter';

function createWebpackFormatter(formatter: Formatter, pathType: FormatterPathType): Formatter {
  // mimics webpack error formatter
  return function webpackFormatter(issue) {
    const color = (text: string) =>
      chalk.bold(issue.severity === 'warning' ? chalk.yellow(text) : chalk.red(text));

    const severity = issue.severity.toUpperCase();

    if (issue.file) {
      let location = chalk.bold(formatFilePath(issue.file, pathType));
      if (issue.location) {
        location += `:${chalk.bold(chalk.green(formatIssueLocation(issue.location)))}`;
      }

      return [`${color(severity)} in ${location}`, formatter(issue), ''].join(os.EOL);
    } else {
      return [`${color(severity)} in ` + formatter(issue), ''].join(os.EOL);
    }
  };
}

export { createWebpackFormatter };
