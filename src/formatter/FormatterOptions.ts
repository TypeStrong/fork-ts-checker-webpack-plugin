import type { Formatter } from './Formatter';
import type { BabelCodeFrameOptions } from './types/babel__code-frame';

type FormatterType = 'basic' | 'codeframe';

type BasicFormatterOptions = {
  type: 'basic';
};
type CodeframeFormatterOptions = {
  type: 'codeframe';
  options?: BabelCodeFrameOptions;
};
type FormatterOptions =
  | undefined
  | FormatterType
  | BasicFormatterOptions
  | CodeframeFormatterOptions
  | Formatter;

export { FormatterOptions, FormatterType, BasicFormatterOptions, CodeframeFormatterOptions };
