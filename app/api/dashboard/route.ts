import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [orders, snapshots] = await Promise.all([
    prisma.order.findMany({ where: { storeId: session.storeId } }),
    prisma.dailyProfitSnapshot.findMany({ where: { storeId: session.storeId }, orderBy: { date: "asc" }, take: 30 })
  ]);

  const revenue = orders.reduce((s, o) => s + o.revenue, 0);
  const totalCosts = orders.reduce((s, o) => s + o.totalCosts, 0);
  const netProfit = revenue - totalCosts;

  return NextResponse.json({
    kpis: {
      revenue,
      totalCosts,
      netProfit,
      netMargin: revenue ? netProfit / revenue : 0
    },
    daily: snapshots.map((s) => ({ date: s.date.toISOString().slice(5, 10), netProfit: s.netProfit })),
    costBreakdown: [
      { label: "COGS", value: orders.reduce((a, o) => a + o.cogs, 0) },
      { label: "Payment Fees", value: orders.reduce((a, o) => a + o.paymentFees, 0) },
      { label: "Shopify Fees", value: orders.reduce((a, o) => a + o.shopifyFees, 0) },
      { label: "Shipping", value: orders.reduce((a, o) => a + o.shippingCost, 0) },
      { label: "Ads", value: orders.reduce((a, o) => a + o.adSpendAllocation, 0) }
    ]
  });
}
