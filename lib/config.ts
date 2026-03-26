export const config = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  appName: "Real Profit for Shopify",
  shopifyApiKey: process.env.SHOPIFY_API_KEY ?? "",
  shopifyApiSecret: process.env.SHOPIFY_API_SECRET ?? "",
  scopes:
    process.env.SHOPIFY_SCOPES ??
    "read_orders,read_products,read_analytics,read_fulfillments,read_customers,write_products",
  apiVersion: process.env.SHOPIFY_API_VERSION ?? "2025-10",
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
  sessionJwtSecret: process.env.SESSION_JWT_SECRET ?? "replace-me"
};
