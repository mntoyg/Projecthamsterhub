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

// Bind every interface explicitly. A platform that injects PORT and probes the
// container from outside (Render does both) needs 0.0.0.0, and relying on Node's
// default is the kind of thing that only fails once it is deployed.
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'listening',
      port: config.port,
      host: '0.0.0.0',
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
