import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { upsertOrderFromWebhook } from "@/lib/services/sync";
import { prisma } from "@/lib/prisma";

function verifyWebhook(body: string, hmac: string | null) {
  if (!hmac) return false;
  const digest = crypto.createHmac("sha256", config.shopifyApiSecret).update(body, "utf8").digest("base64");
  if (digest.length !== hmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export async function POST(req: NextRequest) {
  const topic = req.headers.get("x-shopify-topic");
  const shop = req.headers.get("x-shopify-shop-domain");
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const rawBody = await req.text();

  if (!shop || !verifyWebhook(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (["orders/create", "orders/updated", "orders/cancelled"].includes(topic || "")) {
    await upsertOrderFromWebhook(shop, payload);
  }

  if (topic === "refunds/create") {
    const orderId = String(payload.order_id);
    const refund = Number(payload.transactions?.[0]?.amount ?? 0);
    await prisma.order.updateMany({ where: { shopifyOrderId: orderId }, data: { refunds: refund } });
  }

  if (topic === "app/uninstalled") {
    await prisma.shopifyStore.updateMany({ where: { shopDomain: shop }, data: { accessToken: "" } });
  }

  if (["customers/redact", "customers/data_request", "shop/redact"].includes(topic || "")) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
