import { createServer } from 'node:http';
import { getDb, closeDb } from '@alvora/db';
import { loadConfig } from './config.js';
import { buildServer } from './server.js';
import { TokenService } from './lib/tokens.js';
import { Engine } from './engine/index.js';
import { createGateway } from './realtime/gateway.js';
import { ensureBootstrapAdmin } from './services/bootstrap.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const { db } = getDb({ url: config.DATABASE_URL, max: config.DATABASE_POOL_MAX });
  const tokens = new TokenService(config.JWT_SECRET);

  const engine = new Engine({ db, enabled: config.ENGINE_ENABLED });
  const app = await buildServer({ db, config, tokens, engine });
  engine.attachLogger(app.log);

  await ensureBootstrapAdmin(db, config, app.log);

  const gateway = createGateway({ server: app.server, engine, tokens, db, config, log: app.log });

  await engine.start();

  await app.listen({ host: config.API_HOST, port: config.API_PORT });
  app.log.info(
    { port: config.API_PORT, engine: config.ENGINE_ENABLED, redis: Boolean(config.REDIS_URL) },
    'Alvora API ready',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');
    // Stop accepting work before flushing, so nothing new enters the engine.
    const timer = setTimeout(() => {
      app.log.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 15_000);
    timer.unref();
    try {
      await gateway.close();
      await engine.stop();
      await app.close();
      await closeDb();
      clearTimeout(timer);
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    app.log.error({ err: reason }, 'unhandled rejection');
  });
  process.on('uncaughtException', (error) => {
    app.log.fatal({ err: error }, 'uncaught exception');
    void shutdown('uncaughtException');
  });
}

main().catch((error) => {
  console.error('Failed to start Alvora API:', error);
  process.exit(1);
});
