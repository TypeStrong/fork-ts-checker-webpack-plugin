import os from 'os';
import chalk from 'chalk';
import { relative } from 'path';
import { Formatter } from './Formatter';
import { formatIssueLocation } from '../issue';
import normalizeSlash from '../utils/path/normalizeSlash';

function createWebpackFormatter(formatter: Formatter, context: string): Formatter {
  return function webpackFormatter(issue) {
    const severity = issue.severity.toUpperCase();
    const file = issue.file ? normalizeSlash(relative(context, issue.file)) : undefined;
    const location = issue.location ? formatIssueLocation(issue.location) : undefined;
    const color = issue.severity === 'warning' ? chalk.yellow : chalk.red;
    const header = [severity, 'in', file].concat(location ? [location] : []).join(' ');

    return [color.bold(header), formatter(issue), ''].join(os.EOL);
  };
}

export { createWebpackFormatter };
