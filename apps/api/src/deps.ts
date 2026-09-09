import type { Database } from '@alvora/db';
import type { Config } from './config.js';
import type { TokenService } from './lib/tokens.js';
import type { Engine } from './engine/index.js';

/** Shared services every route module reaches through `app.deps`. */
export interface AppDeps {
  db: Database;
  config: Config;
  tokens: TokenService;
  engine: Engine;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
}
