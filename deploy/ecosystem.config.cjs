/**
 * pm2 process definitions for Alvora Bourse.
 *
 * Written for `pm2 startOrReload deploy/ecosystem.config.cjs --update-env`, which
 * cold-starts on a fresh host and reloads without dropping connections afterwards.
 */
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');

/** Read .env here so pm2 does not depend on the shell that launched it. */
function readEnv() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^"(.*)"$/, '$1').trim();
  }
  return out;
}

const env = readEnv();
const apiPort = env.API_PORT || '4000';
const webPort = env.WEB_PORT || '3000';

const shared = {
  cwd: root,
  time: true,
  autorestart: true,
  max_restarts: 20,
  // A crash loop should back off rather than hammer the database.
  restart_delay: 2000,
  exp_backoff_restart_delay: 200,
  kill_timeout: 20000,
  listen_timeout: 15000,
  merge_logs: true,
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
};

module.exports = {
  apps: [
    {
      ...shared,
      name: 'alvora-api',
      script: 'apps/api/dist/index.js',
      // The engine is a single authoritative simulation: exactly one instance.
      // Running two would produce two competing price loops and double-mine blocks.
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '600M',
      out_file: path.join(root, 'logs/api.out.log'),
      error_file: path.join(root, 'logs/api.err.log'),
      env: { ...env, NODE_ENV: 'production', API_PORT: apiPort },
    },
    {
      ...shared,
      name: 'alvora-web',
      script: 'apps/web/node_modules/next/dist/bin/next',
      args: ['start', '--port', webPort, '--hostname', '127.0.0.1'],
      interpreter: 'node',
      // The web tier is stateless, so it can scale across cores.
      instances: env.WEB_INSTANCES ? Number(env.WEB_INSTANCES) : 2,
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      out_file: path.join(root, 'logs/web.out.log'),
      error_file: path.join(root, 'logs/web.err.log'),
      env: { ...env, NODE_ENV: 'production', PORT: webPort },
    },
  ],
};
