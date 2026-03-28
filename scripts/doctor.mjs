#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredNodeMajor = 20;
const cwd = process.cwd();
const pkgPath = resolve(cwd, 'package.json');

function log(msg) {
  console.log(`[doctor] ${msg}`);
}

function warn(msg) {
  console.warn(`[doctor] WARNING: ${msg}`);
}

function fail(msg) {
  console.error(`[doctor] ERROR: ${msg}`);
  process.exit(1);
}

if (!existsSync(pkgPath)) {
  fail('package.json not found. Run this command from the project root.');
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (Number.isNaN(nodeMajor) || nodeMajor < requiredNodeMajor) {
  fail(`Node ${requiredNodeMajor}+ is required. Current version: ${process.versions.node}`);
}
log(`Node version OK: ${process.versions.node}`);

try {
  const npmVersion = execSync('npm --version', { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  log(`npm version detected: ${npmVersion}`);
} catch {
  warn('Unable to detect npm version.');
}

const packageLockExists = existsSync(resolve(cwd, 'package-lock.json'));
if (!packageLockExists) {
  warn('package-lock.json is missing. Commit it for consistent installs across machines.');
}

const envExample = resolve(cwd, '.env.example');
const envFile = resolve(cwd, '.env');
if (existsSync(envExample) && !existsSync(envFile)) {
  warn('.env is missing. Copy .env.example to .env before running the app.');
}

const prismaSchema = resolve(cwd, 'prisma', 'schema.prisma');
if (!existsSync(prismaSchema)) {
  warn('Prisma schema not found at prisma/schema.prisma');
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (!pkg.dependencies?.next) {
  fail('next is missing from dependencies.');
}
log(`next dependency found: ${pkg.dependencies.next}`);

const nodeModulesExists = existsSync(resolve(cwd, 'node_modules'));
if (!nodeModulesExists) {
  warn('node_modules is missing. Run npm install or npm run setup.');
}

log('Environment checks complete.');
