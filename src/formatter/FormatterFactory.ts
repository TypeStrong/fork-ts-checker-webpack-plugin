import { Formatter } from './Formatter';
import {
  CodeFrameFormatterOptions,
  createCodeframeFormatter
} from './CodeframeFormatter';
import { createDefaultFormatter } from './DefaultFormatter';

type FormatterType = undefined | 'default' | 'codeframe' | Formatter;
type FormatterOptions = CodeFrameFormatterOptions;

function createFormatter(
  type?: FormatterType,
  options?: FormatterOptions
): Formatter {
  if (typeof type === 'function') {
    return type;
  }

  switch (type) {
    case 'codeframe':
      return createCodeframeFormatter(options);

    case 'default':
    case undefined:
      return createDefaultFormatter();

    default:
      throw new Error(
        'Unknown "' +
          type +
          '" formatter. Available types are: default, codeframe.'
      );
  }
}

export { createFormatter, FormatterType, FormatterOptions };
