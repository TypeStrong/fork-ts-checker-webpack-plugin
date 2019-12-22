import * as os from 'os';
import * as fs from 'fs';
import chalk from 'chalk';

import { fileExistsSync } from '../FsHelper';
import { IssueSeverity, IssueOrigin } from '../issue';
import { Formatter } from './Formatter';
import { createInternalFormatter } from './InternalFormatter';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const codeFrame = require('babel-code-frame');

interface CodeFrameFormatterOptions {
  /** Syntax highlight the code as JavaScript for terminals. default: false */
  highlightCode?: boolean;
  /**  The number of lines to show above the error. default: 2 */
  linesBelow?: number;
  /**  The number of lines to show below the error. default: 3 */
  linesAbove?: number;
  /**
   * Forcibly syntax highlight the code as JavaScript (for non-terminals);
   * overrides highlightCode.
   * default: false
   */
  forceColor?: boolean;
}

function createCodeframeFormatter(
  options?: CodeFrameFormatterOptions
): Formatter {
  return function codeframeFormatter(issue) {
    const color = {
      message:
        issue.severity === IssueSeverity.WARNING
          ? chalk.bold.yellow
          : chalk.bold.red,
      position: chalk.dim
    };

    if (issue.origin === IssueOrigin.INTERNAL) {
      return createInternalFormatter()(issue);
    }

    const file = issue.file;
    const source =
      file && fileExistsSync(file) && fs.readFileSync(file, 'utf-8');
    let frame = '';

    if (source) {
      frame = codeFrame(
        source,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        issue.line!, // Assertion: `codeFrame` allows passing undefined, typings are incorrect
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        issue.character!,
        {
          highlightCode: true,
          ...(options || {})
        }
      )
        .split('\n')
        .map((line: string) => '  ' + line)
        .join(os.EOL);
    }

    const lines = [
      color.message(
        `${issue.severity.toUpperCase()} in ${issue.file}(${issue.line},${
          issue.character
        }):`
      ),
      color.position(`${issue.line}:${issue.character} ${issue.message}`)
    ];
    if (frame) {
      lines.push(frame);
    }

    return lines.join(os.EOL);
  };
}

export { createCodeframeFormatter, CodeFrameFormatterOptions };
