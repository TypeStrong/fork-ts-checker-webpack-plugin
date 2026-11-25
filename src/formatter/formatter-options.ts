import type { Options as BabelCodeFrameOptions } from '@babel/code-frame';

import type { Formatter, FormatterPathType } from './formatter';

type FormatterType = 'basic' | 'codeframe';

type BasicFormatterOptions = {
  type: 'basic';
  pathType?: FormatterPathType;
};
type CodeframeFormatterOptions = {
  type: 'codeframe';
  pathType?: FormatterPathType;
  options?: BabelCodeFrameOptions;
};
type FormatterOptions =
  undefined | FormatterType | BasicFormatterOptions | CodeframeFormatterOptions | Formatter;

export { FormatterOptions, FormatterType, BasicFormatterOptions, CodeframeFormatterOptions };
