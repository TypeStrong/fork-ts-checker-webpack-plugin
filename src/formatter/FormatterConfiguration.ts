import { createFormatter } from './FormatterFactory';
import { FormatterOptions } from './FormatterOptions';
import { Formatter } from './Formatter';

type FormatterConfiguration = Formatter;

function createFormatterConfiguration(options: FormatterOptions | undefined) {
  return createFormatter(
    options ? (typeof options === 'string' ? options : options.type || 'codeframe') : 'codeframe',
    options && typeof options === 'object' ? options.options || {} : {}
  );
}

export { FormatterConfiguration, createFormatterConfiguration };
