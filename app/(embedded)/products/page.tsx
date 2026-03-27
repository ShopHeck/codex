import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/shopify/session";

export default async function ProductsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/install");

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
      productId: r.productId ?? r.title,
      productTitle: r.title,
      revenue,
      totalCosts,
      netProfit,
      margin: revenue ? netProfit / revenue : 0
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Product Profitability</h1>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Product</th>
              <th className="p-2 text-right">Revenue</th>
              <th className="p-2 text-right">Costs</th>
              <th className="p-2 text-right">Net Profit</th>
              <th className="p-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId} className="border-t">
                <td className="p-2">{p.productTitle}</td>
                <td className="p-2 text-right">${p.revenue.toFixed(2)}</td>
                <td className="p-2 text-right">${p.totalCosts.toFixed(2)}</td>
                <td className="p-2 text-right">${p.netProfit.toFixed(2)}</td>
                <td className="p-2 text-right">{(p.margin * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
