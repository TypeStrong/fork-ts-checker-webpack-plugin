import os from 'os';
import { join } from 'path';
import { Issue } from 'lib/issue';
import { createBasicFormatter, createWebpackFormatter, Formatter } from 'lib/formatter';

describe('formatter/WebpackFormatter', () => {
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

  let formatter: Formatter;

  beforeEach(() => {
    formatter = createWebpackFormatter(createBasicFormatter());
  });

  it('decorates existing formatter', () => {
    expect(formatter(issue)).toContain('TS123: Some issue content');
  });

  it('formats issue severity', () => {
    expect(formatter({ ...issue, severity: 'error' })).toContain('ERROR');
    expect(formatter({ ...issue, severity: 'warning' })).toContain('WARNING');
  });

  it('formats issue file', () => {
    expect(formatter(issue)).toContain(`./some/file.ts`);
  });

  it('formats location', () => {
    expect(formatter(issue)).toContain(' 1:7-16');
    expect(
      formatter({
        ...issue,
        location: { start: { line: 1, column: 7 }, end: { line: 10, column: 16 } },
      })
    ).toContain(' 1:7-10:16');
  });

  it('formats issue header like webpack', () => {
    expect(formatter(issue)).toEqual(
      [`ERROR in ./some/file.ts 1:7-16`, 'TS123: Some issue content', ''].join(os.EOL)
    );
  });
});
