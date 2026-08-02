import express from 'express';
import morgan from 'morgan';
import http from 'node:http';
import assert from 'node:assert';

import { homepageUrl } from '../common/constants.js';
import logger from './logger.js';
import { isRequestAllowed } from './httpServerUtil.js';
import type { AppEvent } from './index.js';


export default ({ port, onKeyboardAction, onAwaitAppEvent }: {
  port: number,
  onKeyboardAction: (action: string, args: unknown[]) => Promise<void>,
  onAwaitAppEvent: (eventName: string, signal: AbortSignal) => Promise<AppEvent>,
}) => {
  const app = express();

  // https://expressjs.com/en/resources/middleware/morgan.html
  const morganFormat = ':remote-addr :method :url HTTP/:http-version :status - :response-time ms';
  // https://stackoverflow.com/questions/27906551/node-js-logging-use-morgan-and-winston
  app.use(morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  }));

  app.use((req, res, next) => {
    const { host, origin } = req.headers;
    if (!isRequestAllowed({ host, origin, port })) {
      logger.warn('Rejecting HTTP API request', { host, origin });
      res.status(403).send('Forbidden: the HTTP API can only be called by programs running on this computer, not from a web browser.');
      return;
    }
    next();
  });

  const apiRouter = express.Router();

  app.get('/', (_req, res) => res.send(`See ${homepageUrl}`));

  app.use('/api', apiRouter);

  apiRouter.post('/action/:action', express.json(), async (req, res) => {
    // eslint-disable-next-line prefer-destructuring
    const action = req.params['action'];
    const parameters = req.body as unknown;
    assert(action != null);
    await onKeyboardAction(action, [parameters]);
    res.end();
  });

  apiRouter.post('/await-event/:eventName', express.json(), async (req, res) => {
    const { eventName } = req.params;
    assert(eventName != null);
    const abortController = new AbortController();
    abortController.signal.addEventListener('abort', () => logger.info('await-event aborted', eventName));
    req.on('close', () => abortController.abort());
    res.json(await onAwaitAppEvent(eventName, abortController.signal));
  });

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
