import { NextRequest, NextResponse } from "next/server";
import { confirmBillingSubscription, ensureBilling } from "@/lib/services/billing";

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  const chargeId = req.nextUrl.searchParams.get("charge_id");
  const manage = req.nextUrl.searchParams.get("manage");

  if (!storeId) {
    return NextResponse.json({ error: "Missing storeId" }, { status: 400 });
  }

  if (manage) {
    const billing = await ensureBilling(storeId, true);
    return NextResponse.redirect(billing.confirmationUrl!);
  }

  if (!chargeId) {
    const result = await confirmBillingSubscription(storeId, null);
    return NextResponse.redirect(new URL(`/dashboard?billing=${result.result}`, req.url));
  }

  const result = await confirmBillingSubscription(storeId, chargeId);
  return NextResponse.redirect(new URL(`/dashboard?billing=${result.result}`, req.url));
}
