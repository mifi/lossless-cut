const express = require('express');
const morgan = require('morgan');
const http = require('http');
const asyncHandler = require('express-async-handler');
const { homepage } = require('./constants');


const logger = require('./logger');


module.exports = ({ port, onKeyboardAction }) => {
  const app = express();

  // https://expressjs.com/en/resources/middleware/morgan.html
  const morganFormat = ':remote-addr :method :url HTTP/:http-version :status - :response-time ms';
  // https://stackoverflow.com/questions/27906551/node-js-logging-use-morgan-and-winston
  app.use(morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  }));

  const apiRouter = express.Router();

  app.get('/', (req, res) => res.send(`See ${homepage}`));

  app.use('/api', apiRouter);

  apiRouter.post('/shortcuts/:action', express.json(), asyncHandler(async (req, res) => {
    await onKeyboardAction(req.params.action);
    res.end();
  }));

  const server = http.createServer(app);

  server.on('error', (err) => logger.error('http server error', err));

  const startHttpServer = async () => new Promise((resolve, reject) => {
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
