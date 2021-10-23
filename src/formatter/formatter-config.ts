import { createBasicFormatter } from './basic-formatter';
import { createCodeFrameFormatter } from './code-frame-formatter';
import type { Formatter } from './formatter';
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

type FormatterConfig = Formatter;

function createFormatterConfig(options: FormatterOptions | undefined): FormatterConfig {
  if (typeof options === 'function') {
    return options;
  }

  const type = options
    ? typeof options === 'object'
      ? options.type || 'codeframe'
      : options
    : 'codeframe';

  if (!type || type === 'basic') {
    return createBasicFormatter();
  }

  if (type === 'codeframe') {
    const config =
      options && typeof options === 'object'
        ? (options as CodeframeFormatterOptions).options || {}
        : {};
    return createCodeFrameFormatter(config);
  }

  throw new Error(
    `Unknown "${type}" formatter. Available types are: "basic", "codeframe" or a custom function.`
  );
}

export {
  FormatterOptions,
  FormatterType,
  BasicFormatterOptions,
  CodeframeFormatterOptions,
  FormatterConfig,
  createFormatterConfig,
};
