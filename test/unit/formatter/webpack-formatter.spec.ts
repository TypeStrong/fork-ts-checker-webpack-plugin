import os from 'os';
import { join } from 'path';

import type { Formatter } from 'src/formatter';
import { createBasicFormatter, createWebpackFormatter } from 'src/formatter';
import type { Issue } from 'src/issue';
import { forwardSlash } from 'src/utils/path/forward-slash';

describe('formatter/webpack-formatter', () => {
  const issue: Issue = {
    severity: 'error',
    code: 'TS123',
    message: 'Some issue content',
    file: join(process.cwd(), 'some/file.ts'),
    location: {
      start: {
        line: 1,
        column: 7,
      },
      end: {
        line: 1,
        column: 16,
      },
    },
  };

  let relativeFormatter: Formatter;
  let absoluteFormatter: Formatter;

  beforeEach(() => {
    relativeFormatter = createWebpackFormatter(createBasicFormatter(), 'relative');
    absoluteFormatter = createWebpackFormatter(createBasicFormatter(), 'absolute');
  });

  it('decorates existing relativeFormatter', () => {
    expect(relativeFormatter(issue)).toContain('TS123: Some issue content');
  });

  it('formats issue severity', () => {
    expect(relativeFormatter({ ...issue, severity: 'error' })).toContain('ERROR');
    expect(relativeFormatter({ ...issue, severity: 'warning' })).toContain('WARNING');
  });

  it('formats issue file', () => {
    expect(relativeFormatter(issue)).toContain(`./some/file.ts`);
    expect(absoluteFormatter(issue)).toContain(forwardSlash(`${process.cwd()}/some/file.ts`));
  });

  it('formats location', () => {
    expect(relativeFormatter(issue)).toContain(':1:7');
    expect(
      relativeFormatter({
        ...issue,
        location: { start: { line: 1, column: 7 }, end: { line: 10, column: 16 } },
      })
    ).toContain(':1:7');
  });

  it('formats issue header like webpack', () => {
    expect(relativeFormatter(issue)).toEqual(
      [`ERROR in ./some/file.ts:1:7`, 'TS123: Some issue content', ''].join(os.EOL)
    );
  });
});
