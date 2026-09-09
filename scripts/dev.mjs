#!/usr/bin/env node
/**
 * Local development runner.
 *
 * Builds the two libraries once, then keeps the API and the web app running side
 * by side with a single Ctrl-C. Avoids a `concurrently` dependency, and makes the
 * ordering explicit: the API cannot compile before @alvora/shared exists on disk.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

if (!existsSync(path.join(root, '.env'))) {
  console.error('Aucun fichier .env — copiez .env.example vers .env avant de lancer le mode dev.');
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function run(name, command, args, color) {
  const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  children.push(child);

  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`${prefix}s'est arrêté (code ${code})`);
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const build = spawn('npm', ['run', 'build:packages'], { cwd: root, stdio: 'inherit' });
build.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  run('api', 'npm', ['run', 'dev', '-w', '@alvora/api'], '36');
  run('web', 'npm', ['run', 'dev', '-w', '@alvora/web'], '35');
});
