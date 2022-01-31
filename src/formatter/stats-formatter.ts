import chalk from 'chalk';
import type { Stats } from 'webpack';

import type { Issue } from '../issue';

// mimics webpack's stats summary formatter
export function statsFormatter(issues: Issue[], stats: Stats): string {
  const errorsNumber = issues.filter((issue) => issue.severity === 'error').length;
  const warningsNumber = issues.filter((issue) => issue.severity === 'warning').length;
  const errorsFormatted = errorsNumber
    ? chalk.red.bold(`${errorsNumber} ${errorsNumber === 1 ? 'error' : 'errors'}`)
    : '';
  const warningsFormatted = warningsNumber
    ? chalk.yellow.bold(`${warningsNumber} ${warningsNumber === 1 ? 'warning' : 'warnings'}`)
    : '';
  const timeFormatted = Math.round(Date.now() - stats.startTime);

  return [
    'Found ',
    errorsFormatted,
    errorsFormatted && warningsFormatted ? ' and ' : '',
    warningsFormatted,
    ` in ${timeFormatted} ms`,
    '.',
  ].join('');
}
