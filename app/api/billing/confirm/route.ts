import { NextRequest, NextResponse } from "next/server";
import { BillingStatus } from "@prisma/client";
import { ensureBilling, confirmLatestPendingBilling } from "@/lib/services/billing";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { prisma } from "@/lib/prisma";

function normalizeShop(shop: string) {
  return shop.trim().toLowerCase();
}

function errorResponse(req: NextRequest, message: string, status: number) {
  const acceptHeader = req.headers.get("accept") ?? "";
  if (acceptHeader.includes("text/html")) {
    return new NextResponse(
      `<!doctype html><html><body><h1>Billing confirmation failed</h1><p>${message}</p></body></html>`,
      {
        status,
        headers: { "content-type": "text/html; charset=utf-8" }
      }
    );
  }

  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  const chargeId = req.nextUrl.searchParams.get("charge_id")?.trim() ?? null;
  const manage = req.nextUrl.searchParams.get("manage");
  const shop = req.nextUrl.searchParams.get("shop");

  if (!storeId) {
    return NextResponse.json({ error: "Missing storeId" }, { status: 400 });
  }

  const store = await prisma.shopifyStore.findUnique({ where: { id: storeId } });
  if (!store) {
    return errorResponse(req, "Invalid billing callback: unknown store.", 404);
  }

  const session = await getSessionFromCookies();

  if (shop && normalizeShop(store.shopDomain) !== normalizeShop(shop)) {
    return errorResponse(req, "Invalid billing callback: does not belong to this store.", 400);
  }

  if (manage) {
    if (
      !session ||
      session.storeId !== storeId ||
      (shop && normalizeShop(session.shop) !== normalizeShop(shop))
    ) {
      return errorResponse(req, "Unauthorized billing manage request.", 401);
    }

    const billing = await ensureBilling(storeId, true);
    return NextResponse.redirect(billing.confirmationUrl!);
  }

  if (!chargeId) {
    return NextResponse.json({ error: "Missing billing callback params" }, { status: 400 });
  }

  const confirmation = await confirmLatestPendingBilling(storeId, chargeId);

  if (confirmation.outcome === "activated" || confirmation.outcome === "already_processed") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (confirmation.outcome === "pending") {
    return errorResponse(req, "Billing is still pending approval. Please accept the subscription in Shopify and try again.", 409);
  }

  if (confirmation.outcome === "cancelled" || confirmation.outcome === "invalid") {
    const declinedMessage = confirmation.status === BillingStatus.CANCELLED
      ? "Billing was declined or cancelled in Shopify."
      : "Billing callback is invalid.";

    return errorResponse(req, declinedMessage, 402);
  }

  return errorResponse(req, "Unable to confirm billing at this time.", 500);
}
