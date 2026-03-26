import { Card } from "@/components/ui/card";

async function getOrders() {
  const res = await fetch(`${process.env.APP_URL}/api/orders`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders;
}

export default async function OrdersPage() {
  const orders = await getOrders();

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
            {orders.map((o: any) => (
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
