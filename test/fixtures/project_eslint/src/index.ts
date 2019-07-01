import { arrayOfStringTriggeringError } from './lib/func';

// This code should trigger no error as it has a different `.eslintrc.js` to `func.ts`
export const arrayOfStringButNoComplaint: Array<string> = [
  ...arrayOfStringTriggeringError
];
