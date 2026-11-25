import type { Issue } from 'src/issue';

/** The source files the formatter specs mock with `mockFiles`. */
export const SOURCE_FILES = {
  'src/index.ts': [
    'const foo: number = "1";',
    'const bar = 1;',
    '',
    'function baz() {',
    '  console.log(baz);',
    '}',
  ].join('\n'),
};

/** An issue in `src/index.ts` of `SOURCE_FILES`. */
export const ISSUE: Issue = {
  severity: 'error',
  code: 'TS2322',
  message: `Type '"1"' is not assignable to type 'number'.`,
  file: 'src/index.ts',
  location: {
    start: {
      line: 1,
      column: 7,
    },
    end: {
      line: 1,
      column: 10,
    },
  },
};
