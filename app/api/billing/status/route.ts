import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { ensureBilling } from "@/lib/services/billing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.redirect(new URL("/install", config.appUrl));

  const result = await ensureBilling(session.storeId);
  if (result.active) return NextResponse.redirect(new URL("/onboarding", config.appUrl));

  return NextResponse.redirect(result.confirmationUrl!);
}
