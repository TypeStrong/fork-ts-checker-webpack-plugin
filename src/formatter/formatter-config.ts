import { createBasicFormatter } from './basic-formatter';
import { createCodeFrameFormatter } from './code-frame-formatter';
import type { Formatter } from './formatter';
import type { CodeframeFormatterOptions, FormatterOptions } from './formatter-options';

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

export { FormatterConfig, createFormatterConfig };
