import type Logger from './Logger';
import type { LoggerType } from './LoggerFactory';

type LoggerOptions = {
  infrastructure?: LoggerType | Logger;
  issues?: LoggerType | Logger;
  devServer?: boolean;
};

export default LoggerOptions;
