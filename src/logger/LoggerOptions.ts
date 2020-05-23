import { LoggerType } from './LoggerFactory';
import Logger from './Logger';

type LoggerOptions = {
  infrastructure?: LoggerType | Logger;
  issues?: LoggerType | Logger;
};

export default LoggerOptions;
