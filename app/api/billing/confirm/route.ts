import { NextRequest, NextResponse } from "next/server";
import { activateBilling, ensureBilling } from "@/lib/services/billing";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  const storeId = req.nextUrl.searchParams.get("storeId");
  const chargeId = req.nextUrl.searchParams.get("charge_id");
  const manage = req.nextUrl.searchParams.get("manage");

  if (manage && storeId) {
    const billing = await ensureBilling(storeId, true);
    return NextResponse.redirect(billing.confirmationUrl!);
  }

  if (!shop || !storeId || !chargeId) {
    return NextResponse.json({ error: "Missing billing callback params" }, { status: 400 });
  }

  await activateBilling(storeId, `gid://shopify/AppSubscription/${chargeId}`);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
