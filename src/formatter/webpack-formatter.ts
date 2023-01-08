import os from 'os';
import path from 'path';

import chalk from 'chalk';

import { formatIssueLocation } from '../issue';
import { forwardSlash } from '../utils/path/forward-slash';
import { relativeToContext } from '../utils/path/relative-to-context';

import type { Formatter, FormatterPathType } from './formatter';

function createWebpackFormatter(formatter: Formatter, pathType: FormatterPathType): Formatter {
  // mimics webpack error formatter
  return function webpackFormatter(issue) {
    const color = issue.severity === 'warning' ? chalk.yellow.bold : chalk.red.bold;

    const severity = issue.severity.toUpperCase();

    if (issue.file) {
      let location = chalk.bold(
        pathType === 'absolute'
          ? forwardSlash(path.resolve(issue.file))
          : relativeToContext(issue.file, process.cwd())
      );
      if (issue.location) {
        location += `:${chalk.green.bold(formatIssueLocation(issue.location))}`;
      }

      return [`${color(severity)} in ${location}`, formatter(issue), ''].join(os.EOL);
    } else {
      return [`${color(severity)} in ` + formatter(issue), ''].join(os.EOL);
    }
  };
}

export { createWebpackFormatter };
