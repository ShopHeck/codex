import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const insights = await getStoreInsights(session.storeId);
  const topProfitableProducts = insights.products.filter((product) => product.netProfit > 0).slice(0, 3);
  const topDestroyingProducts = insights.products
    .filter((product) => product.netProfit < 0)
    .sort((a, b) => a.netProfit - b.netProfit)
    .slice(0, 3);

  return NextResponse.json({
    kpis: insights.kpis,
    confidence: insights.confidence,
    daily: insights.daily,
    costBreakdown: insights.leaks.map((leak) => ({ label: leak.label, value: leak.value })),
    recommendations: insights.recommendations.slice(0, 3),
    topProfitableProducts,
    topDestroyingProducts
  });
}
