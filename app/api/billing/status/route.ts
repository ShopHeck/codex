import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { ensureBilling } from "@/lib/services/billing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.redirect(new URL("/install", process.env.APP_URL));

  const result = await ensureBilling(session.storeId);
  if (result.active) return NextResponse.redirect(new URL("/onboarding", process.env.APP_URL));

  return NextResponse.redirect(result.confirmationUrl!);
}
