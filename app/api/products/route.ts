import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.orderItem.groupBy({
    by: ["productId", "title"],
    where: { order: { storeId: session.storeId } },
    _sum: { totalRevenue: true, totalCogs: true }
  });

  const products = rows.map((r) => {
    const revenue = r._sum.totalRevenue ?? 0;
    const totalCosts = r._sum.totalCogs ?? 0;
    const netProfit = revenue - totalCosts;
    return {
      productId: r.productId,
      productTitle: r.title,
      revenue,
      totalCosts,
      netProfit,
      margin: revenue ? netProfit / revenue : 0
    };
  });

  return NextResponse.json({ products });
}
