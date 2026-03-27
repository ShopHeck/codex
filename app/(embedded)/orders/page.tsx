import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/shopify/session";

export default async function OrdersPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/install");

  const orders = await prisma.order.findMany({
    where: { storeId: session.storeId },
    orderBy: { orderDate: "desc" },
    take: 100
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Order Profit</h1>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Order</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-right">Revenue</th>
              <th className="p-2 text-right">Costs</th>
              <th className="p-2 text-right">Net Profit</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-2">{o.orderNumber}</td>
                <td className="p-2">{new Date(o.orderDate).toLocaleDateString()}</td>
                <td className="p-2 text-right">${o.revenue.toFixed(2)}</td>
                <td className="p-2 text-right">${o.totalCosts.toFixed(2)}</td>
                <td className="p-2 text-right font-medium">${o.netProfit.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
