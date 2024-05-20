import winston from 'winston';
import util from 'node:util';
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';
import { join } from 'node:path';
// eslint-disable-next-line import/no-extraneous-dependencies
import type { TransformableInfo } from 'logform';


// https://mifi.no/blog/winston-electron-logger/

// https://github.com/winstonjs/winston/issues/1427
const combineMessageAndSplat = () => ({
  transform(info: TransformableInfo) {
    // @ts-expect-error todo
    const { [Symbol.for('splat')]: args = [], message } = info;
    // eslint-disable-next-line no-param-reassign
    info.message = util.format(message, ...args);
    return info;
  },
});

const createLogger = () => winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    combineMessageAndSplat(),
    winston.format.printf((info) => `${info['timestamp']} ${info.level}: ${info.message}`),
  ),
});

const logDirPath = app.isPackaged ? app.getPath('userData') : '.';
export const logFilePath = join(logDirPath, 'app.log');

const logger = createLogger();
logger.add(new winston.transports.Console());
logger.add(new winston.transports.File({ level: 'debug', filename: logFilePath, options: { flags: 'a' }, maxsize: 1e6, maxFiles: 100, tailable: true }));

export default logger;
