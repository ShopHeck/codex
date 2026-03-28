const requiredEnvKeys = [
  "APP_URL",
  "DATABASE_URL",
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_SCOPES",
  "SHOPIFY_API_VERSION",
  "SESSION_JWT_SECRET"
] as const;

type RequiredEnvKey = (typeof requiredEnvKeys)[number];

const testEnvDefaults: Record<RequiredEnvKey, string> = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "file:./test.db",
  SHOPIFY_API_KEY: "",
  SHOPIFY_API_SECRET: "",
  SHOPIFY_SCOPES: "",
  SHOPIFY_API_VERSION: "2024-01",
  SESSION_JWT_SECRET: "test-secret"
};

function requiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key]?.trim();

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === "test") {
    return testEnvDefaults[key];
  }

  throw new Error(
    `[config] Missing required environment variable: ${key}. Copy .env.example and set ${key} before starting the app.`
  );
}

function validateAppUrl(rawAppUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(rawAppUrl);
  } catch {
    throw new Error(
      `[config] APP_URL must be a valid absolute URL (received: ${rawAppUrl}).`
    );
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(
      `[config] APP_URL must use http or https (received protocol: ${parsed.protocol}).`
    );
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(
      `[config] APP_URL must be an origin only (for example: https://abc123.ngrok-free.app), without path, query, or hash.`
    );
  }

  return parsed.origin;
}

function createConfig() {
  return {
    appUrl: validateAppUrl(requiredEnv("APP_URL")),
    appName: "Real Profit for Shopify",
    databaseUrl: requiredEnv("DATABASE_URL"),
    shopifyApiKey: requiredEnv("SHOPIFY_API_KEY"),
    shopifyApiSecret: requiredEnv("SHOPIFY_API_SECRET"),
    scopes: requiredEnv("SHOPIFY_SCOPES"),
    apiVersion: requiredEnv("SHOPIFY_API_VERSION"),
    billing: {
      starter: {
        name: "Starter",
        lineItem: {
          amount: 29,
          currencyCode: "USD",
          interval: "EVERY_30_DAYS"
        }
      }
    },
    sessionJwtSecret: requiredEnv("SESSION_JWT_SECRET")
  };
}

type Config = ReturnType<typeof createConfig>;

let cachedConfig: Config | null = null;

function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = createConfig();
  }

  return cachedConfig;
}

export function validateConfig() {
  void getConfig();
}

export const config: Config = new Proxy({} as Config, {
  get(_target, prop) {
    return getConfig()[prop as keyof Config];
  }
});
