import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const insights = await getStoreInsights(session.storeId);

  return NextResponse.json({
    kpis: insights.kpis,
    confidence: insights.confidence,
    daily: insights.daily,
    topLosingProducts: insights.topLosingProducts,
    costBreakdown: insights.leaks.map((leak) => ({ label: leak.label, value: leak.value })),
    recommendations: insights.recommendations.slice(0, 3)
  });
}
