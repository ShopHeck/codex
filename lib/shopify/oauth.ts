import crypto from "node:crypto";
import { config } from "@/lib/config";

export function normalizeShopDomain(raw: string) {
  const shop = raw.trim().toLowerCase();
  if (!shop.endsWith(".myshopify.com")) throw new Error("Invalid shop domain");
  return shop;
}

export function buildAuthUrl(shop: string, state: string) {
  const redirectUri = `${config.appUrl}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: config.shopifyApiKey,
    scope: config.scopes,
    redirect_uri: redirectUri,
    state
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(shop: string, code: string) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.shopifyApiKey,
      client_secret: config.shopifyApiSecret,
      code
    })
  });

  if (!res.ok) throw new Error("Token exchange failed");
  return res.json() as Promise<{ access_token: string; scope: string }>;
}

export function generateState() {
  return crypto.randomBytes(16).toString("hex");
}

export function verifyHmac(params: URLSearchParams) {
  const hmac = params.get("hmac");
  if (!hmac) return false;

  const filtered = [...params.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const generated = crypto
    .createHmac("sha256", config.shopifyApiSecret)
    .update(filtered)
    .digest("hex");

  if (generated.length !== hmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(hmac));
}
