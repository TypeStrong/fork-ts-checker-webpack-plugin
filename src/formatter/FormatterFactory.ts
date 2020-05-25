import { Formatter } from './Formatter';
import { BabelCodeFrameOptions, createCodeFrameFormatter } from './CodeFrameFormatter';
import { createBasicFormatter } from './BasicFormatter';

type NotConfigurableFormatterType = undefined | 'basic';
type ConfigurableFormatterType = 'codeframe';
type FormatterType = NotConfigurableFormatterType | ConfigurableFormatterType;

type ConfigurableFormatterOptions = {
  codeframe: BabelCodeFrameOptions;
};
type ComplexFormatterOptions<T extends FormatterType> = T extends ConfigurableFormatterType
  ? ConfigurableFormatterOptions[T]
  : never;

// for not-configurable formatter type, provide single declaration
function createFormatter<T extends NotConfigurableFormatterType>(type?: T): Formatter;
// for each configurable formatter type, provide declaration with related configuration type
function createFormatter<T extends ConfigurableFormatterType>(
  type: T,
  options?: ConfigurableFormatterOptions[T]
): Formatter;

// for general use-case provide single declaration
function createFormatter<T extends FormatterType>(type: T, options?: object): Formatter;
// declare function implementation
function createFormatter(type?: FormatterType, options?: object): Formatter {
  switch (type) {
    case 'basic':
    case undefined:
      return createBasicFormatter();

    case 'codeframe':
      return createCodeFrameFormatter(options);

    default:
      throw new Error(`Unknown "${type}" formatter. Available types are: basic, codeframe.`);
  }
}

export {
  createFormatter,
  FormatterType,
  ComplexFormatterOptions,
  NotConfigurableFormatterType,
  ConfigurableFormatterType,
  ConfigurableFormatterOptions,
};
