import { Formatter } from './Formatter';
import { BabelCodeFrameOptions, createCodeframeFormatter } from './CodeframeFormatter';
import { createBasicFormatter } from './BasicFormatter';

type NotConfigurableFormatterType = undefined | 'basic' | Formatter;
type ConfigurableFormatterOptionTypes = {
  codeframe: BabelCodeFrameOptions;
};
type ConfigurableFormatterType = keyof ConfigurableFormatterOptionTypes;
type ConfigurableFormatterOptions<
  T extends ConfigurableFormatterType
> = ConfigurableFormatterOptionTypes[T];

type FormatterType = NotConfigurableFormatterType | ConfigurableFormatterType;
type ComplexFormatterOptions<T extends FormatterType> = T extends ConfigurableFormatterType
  ? ConfigurableFormatterOptions<T>
  : never;

// for not-configurable formatter type, provide single declaration
function createFormatter<T extends NotConfigurableFormatterType>(type?: T): Formatter;
// for each configurable formatter type, provide declaration with related configuration type
function createFormatter<T extends ConfigurableFormatterType>(
  type: T,
  options?: ConfigurableFormatterOptions<T>
): Formatter;

// for general use-case provide single declaration
function createFormatter<T extends FormatterType>(type: T, options?: object): Formatter;
// declare function implementation
function createFormatter(type?: FormatterType, options?: object): Formatter {
  if (typeof type === 'function') {
    return type;
  }

  switch (type) {
    case 'basic':
    case undefined:
      return createBasicFormatter();

    case 'codeframe':
      return createCodeframeFormatter(options);

    default:
      throw new Error('Unknown "' + type + '" formatter. Available types are: basic, codeframe.');
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
