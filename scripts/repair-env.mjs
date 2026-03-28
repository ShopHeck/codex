#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

function run(command) {
  console.log(`[repair] ${command}`);
  execSync(command, { stdio: 'inherit' });
}

const cwd = process.cwd();
const envExample = resolve(cwd, '.env.example');
const envFile = resolve(cwd, '.env');

try {
  run('node scripts/doctor.mjs');

  if (existsSync(envExample) && !existsSync(envFile)) {
    copyFileSync(envExample, envFile);
    console.log('[repair] Created .env from .env.example');
  }

  if (!existsSync(resolve(cwd, 'node_modules'))) {
    run('npm install');
  }

  run('npx prisma generate');
  console.log('[repair] Environment repair complete.');
} catch (error) {
  console.error('[repair] Failed to repair environment.');
  process.exit(error?.status || 1);
}
