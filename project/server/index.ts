// Entry point: resolve configuration once, open the database, listen.
import { createApp } from './app';
import { config } from './config';
import { openDb } from './db';

const db = openDb(config.dbFile);
const app = createApp(db);

if (config.corsOrigins.length === 0) {
  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'cors_open',
      detail: 'CORS_ORIGINS is empty, so any origin is accepted. Set it before deploying.',
    }),
  );
}

const server = app.listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'listening',
      url: `http://localhost:${config.port}`,
      db: config.dbFile,
    }),
  );
});

const shutdown = (signal: string) => {
  console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
