#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];

  const envPath = resolve(cwd, ".env");
  if (!existsSync(envPath)) return undefined;

  const text = readFileSync(envPath, "utf8");
  const line = text
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`));

  if (!line) return undefined;
  return line.slice(key.length + 1).replace(/^['\"]|['\"]$/g, "");
}

function fail(message) {
  console.error(`[verify-shopify-config] ERROR: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[verify-shopify-config] ${message}`);
}

const requiredRouteFiles = [
  "app/install/page.tsx",
  "app/api/auth/callback/route.ts",
  "app/api/shopify/webhooks/route.ts"
];

for (const routeFile of requiredRouteFiles) {
  if (!existsSync(resolve(cwd, routeFile))) {
    fail(`Missing route file expected by Partner dashboard URL mapping: ${routeFile}`);
  }
}

const appUrl = readEnvValue("APP_URL");
if (!appUrl) {
  fail("APP_URL is not set in environment or .env");
}

let normalizedAppUrl;
try {
  const url = new URL(appUrl);
  normalizedAppUrl = url.toString().replace(/\/$/, "");
} catch {
  fail(`APP_URL is not a valid URL: ${appUrl}`);
}

log("Route parity check:");
log(`- App URL should be: ${normalizedAppUrl}/install`);
log(`- OAuth redirect URL should be: ${normalizedAppUrl}/api/auth/callback`);
log(`- Webhook endpoint should be: ${normalizedAppUrl}/api/shopify/webhooks`);

const configuredScopes = (readEnvValue("SHOPIFY_SCOPES") ?? "")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

const requiredScopes = ["read_orders", "read_products", "read_customers"];
const missingScopes = requiredScopes.filter((scope) => !configuredScopes.includes(scope));

if (!configuredScopes.length) {
  fail("SHOPIFY_SCOPES is empty. It must include required scopes.");
}

if (missingScopes.length > 0) {
  fail(`SHOPIFY_SCOPES is missing required scope(s): ${missingScopes.join(", ")}`);
}

log(`SHOPIFY_SCOPES includes required scopes: ${requiredScopes.join(", ")}`);
log("Reminder: keep one stable staging domain in Partner settings to reduce OAuth callback mismatch errors.");
