// tslint:disable:no-console
import { Logger } from '.';

const defaultLogger: Logger = {
  // since `console.warn` is an alias to `console.error`,
  // and `console.error` is really only a `console.info` for stderr
  // instead of stdout, these are all equivalent by default.
  error: console.error,
  warn: console.error,
  info: console.error
};

export default defaultLogger;
