import { config } from "@/lib/config";

export async function shopifyGraphQL<T>(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(`https://${shop}/admin/api/${config.apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) {
    throw new Error(`Shopify GraphQL error: ${res.status}`);
  }

  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data as T;
}
