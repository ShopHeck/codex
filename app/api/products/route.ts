import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const insights = await getStoreInsights(session.storeId);
  return NextResponse.json({ products: insights.products, confidence: insights.confidence });
}
