import { createBasicFormatter } from './basic-formatter';
import { createCodeFrameFormatter } from './code-frame-formatter';
import type { Formatter, FormatterPathType } from './formatter';
import type { CodeframeFormatterOptions, FormatterOptions } from './formatter-options';

type FormatterConfig = {
  format: Formatter;
  pathType: FormatterPathType;
};

function createFormatterConfig(options: FormatterOptions | undefined): FormatterConfig {
  if (typeof options === 'function') {
    return {
      format: options,
      pathType: 'relative',
    };
  }

  const type = options
    ? typeof options === 'object'
      ? options.type || 'codeframe'
      : options
    : 'codeframe';
  const pathType =
    options && typeof options === 'object' ? options.pathType || 'relative' : 'relative';

  if (!type || type === 'basic') {
    return {
      format: createBasicFormatter(),
      pathType,
    };
  }

  if (type === 'codeframe') {
    const config =
      options && typeof options === 'object'
        ? (options as CodeframeFormatterOptions).options || {}
        : {};

    return {
      format: createCodeFrameFormatter(config),
      pathType,
    };
  }

  throw new Error(
    `Unknown "${type}" formatter. Available types are: "basic", "codeframe" or a custom function.`
  );
}

export { FormatterConfig, createFormatterConfig };
