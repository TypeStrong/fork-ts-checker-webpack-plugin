import { ComplexFormatterOptions, FormatterType } from './FormatterFactory';

type ComplexFormatterType = Exclude<FormatterType, Function>;
type ComplexFormatterPreferences<T extends ComplexFormatterType = ComplexFormatterType> = {
  type: T;
  options?: ComplexFormatterOptions<T>;
};
type FormatterOptions = FormatterType | ComplexFormatterPreferences;

export { FormatterOptions };
