import { arrayOfStringTriggeringError } from './lib/func';

// This code should trigger this error
// Array type using 'Array<string>' is forbidden. Use 'string[]' instead.eslint(@typescript-eslint/array-type)
export const arrayOfStringButNoComplaint: Array<string> = [
  ...arrayOfStringTriggeringError
];
