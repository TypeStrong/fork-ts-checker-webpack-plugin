import type Logger from './logger';
import type { LoggerType } from './logger-factory';

type LoggerOptions = {
  infrastructure?: LoggerType | Logger;
  issues?: LoggerType | Logger;
  devServer?: boolean;
};

export default LoggerOptions;
