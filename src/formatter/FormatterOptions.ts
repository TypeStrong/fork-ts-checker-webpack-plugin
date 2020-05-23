import { ComplexFormatterOptions, FormatterType } from './FormatterFactory';

type ComplexFormatterPreferences<T extends FormatterType = FormatterType> = {
  type: T;
  options?: ComplexFormatterOptions<T>;
};
type FormatterOptions = FormatterType | ComplexFormatterPreferences;

export { FormatterOptions };
