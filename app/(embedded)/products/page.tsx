import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";

export default async function ProductsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/install");

  const data = await getStoreInsights(session.storeId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Product Profitability</h1>
        <p className="text-sm text-muted-foreground">Confidence: {data.confidence.score}/100</p>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Product</th>
              <th className="p-2 text-right">Revenue</th>
              <th className="p-2 text-right">Net Profit</th>
              <th className="p-2 text-right">Margin %</th>
              <th className="p-2 text-right">Refund Rate</th>
              <th className="p-2 text-right">Shipping Burden</th>
              <th className="p-2 text-right">Ad-adjusted Margin</th>
              <th className="p-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((product) => (
              <tr key={product.productId} className="border-t">
                <td className="p-2">{product.productTitle}</td>
                <td className="p-2 text-right">${product.revenue.toFixed(2)}</td>
                <td className="p-2 text-right">${product.netProfit.toFixed(2)}</td>
                <td className="p-2 text-right">{(product.margin * 100).toFixed(1)}%</td>
                <td className="p-2 text-right">{(product.refundRate * 100).toFixed(1)}%</td>
                <td className="p-2 text-right">{(product.shippingBurden * 100).toFixed(1)}%</td>
                <td className="p-2 text-right">{(product.adAdjustedMargin * 100).toFixed(1)}%</td>
                <td className="p-2 text-right">{product.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
