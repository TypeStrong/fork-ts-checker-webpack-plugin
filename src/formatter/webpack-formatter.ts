import os from 'os';

import pc from 'picocolors';

import { formatIssueLocation } from '../issue';
import { formatFilePath } from '../utils/path/format-file-path';

import type { Formatter, FormatterPathType } from './formatter';

function createWebpackFormatter(formatter: Formatter, pathType: FormatterPathType): Formatter {
  // mimics webpack error formatter
  return function webpackFormatter(issue) {
    const color = (text: string) =>
      pc.bold(issue.severity === 'warning' ? pc.yellow(text) : pc.red(text));

    const severity = issue.severity.toUpperCase();

    if (issue.file) {
      let location = pc.bold(formatFilePath(issue.file, pathType));
      if (issue.location) {
        location += `:${pc.bold(pc.green(formatIssueLocation(issue.location)))}`;
      }

      return [`${color(severity)} in ${location}`, formatter(issue), ''].join(os.EOL);
    } else {
      return [`${color(severity)} in ` + formatter(issue), ''].join(os.EOL);
    }
  };
}

export { createWebpackFormatter };
