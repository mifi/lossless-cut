import express from 'express';
import morgan from 'morgan';
import http from 'node:http';
import asyncHandler from 'express-async-handler';
import assert from 'node:assert';

import { homepageUrl } from '../common/constants.js';
import logger from './logger.js';


export default ({ port, onKeyboardAction }: {
  port: number, onKeyboardAction: (action: string, args: unknown[]) => Promise<void>,
}) => {
  const app = express();

  // https://expressjs.com/en/resources/middleware/morgan.html
  const morganFormat = ':remote-addr :method :url HTTP/:http-version :status - :response-time ms';
  // https://stackoverflow.com/questions/27906551/node-js-logging-use-morgan-and-winston
  app.use(morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  }));

  const apiRouter = express.Router();

  app.get('/', (_req, res) => res.send(`See ${homepageUrl}`));

  app.use('/api', apiRouter);

  apiRouter.post('/action/:action', express.json(), asyncHandler(async (req, res) => {
    // eslint-disable-next-line prefer-destructuring
    const action = req.params['action'];
    const parameters = req.body as unknown;
    assert(action != null);
    await onKeyboardAction(action, [parameters]);
    res.end();
  }));

  const server = http.createServer(app);

  server.on('error', (err) => logger.error('http server error', err));

  const startHttpServer = async () => new Promise<void>((resolve, reject) => {
    // force ipv4
    const host = '127.0.0.1';
    server.listen(port, host, () => {
      logger.info('HTTP API listening on', `http://${host}:${port}/`);
      resolve();
    });

    server.once('error', reject);
  });

  return {
    startHttpServer,
  };
};
