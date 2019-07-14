import { arrayOfStringTriggeringError } from './lib/func';
import { y } from './lib/otherFunc';

// This code should trigger no error as it has a different `.eslintrc.js` to `func.ts`
export const arrayOfStringButNoComplaint: Array<string> = [
  ...arrayOfStringTriggeringError
];

let x = y;
console.log(x);
