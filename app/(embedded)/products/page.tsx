import { Card } from "@/components/ui/card";

async function getProducts() {
  const res = await fetch(`${process.env.APP_URL}/api/products`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.products;
}

export default async function ProductsPage() {
  const products = await getProducts();

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
            {products.map((p: any) => (
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
