import { CodeframeFormatterOptions, FormatterOptions } from './FormatterOptions';
import { Formatter } from './Formatter';
import { createBasicFormatter } from './BasicFormatter';
import { createCodeFrameFormatter } from './CodeFrameFormatter';

type FormatterConfiguration = Formatter;

function createFormatterConfiguration(
  options: FormatterOptions | undefined
): FormatterConfiguration {
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
    const configuration =
      options && typeof options === 'object'
        ? (options as CodeframeFormatterOptions).options || {}
        : {};
    return createCodeFrameFormatter(configuration);
  }

  throw new Error(
    `Unknown "${type}" formatter. Available types are: "basic", "codeframe" or a custom function.`
  );
}

export { FormatterConfiguration, createFormatterConfiguration };
