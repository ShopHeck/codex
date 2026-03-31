import { redirect } from "next/navigation";
import { ProfitChart } from "@/components/charts/profit-chart";
import { KpiCards } from "@/components/layout/kpi-cards";
import { Card } from "@/components/ui/card";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";
import { formatWaterfallTotal, getNetProfitVisualState } from "@/lib/profit-visuals";

export default async function DashboardPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/install");
  }

  const data = await getStoreInsights(session.storeId);
  const netProfitState = getNetProfitVisualState(data.kpis.netProfit);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Real Profit Dashboard</h1>
      <KpiCards kpis={data.kpis} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Daily Net Profit</h2>
          <ProfitChart points={data.daily} />
        </Card>
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">Profit Waterfall Total</h2>
          <p className={`text-2xl font-semibold ${netProfitState === "loss" ? "text-red-600" : netProfitState === "profit" ? "text-emerald-600" : "text-muted-foreground"}`}>
            {formatWaterfallTotal(data.kpis.netProfit)}
          </p>
          <p className="text-sm text-muted-foreground">Net profit after discounts, refunds, shipping, fees, ads, and variable costs.</p>
        </Card>
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">Confidence & Priority Actions</h2>
          <p className="text-sm text-muted-foreground">
            Confidence score: <span className="font-medium text-foreground">{data.confidence.score}/100 ({data.confidence.band})</span>
          </p>
          <ul className="space-y-2 text-sm">
            {data.recommendations.slice(0, 3).map((recommendation) => (
              <li key={recommendation.title} className="rounded border p-2">
                <p className="font-medium">
                  {recommendation.category}: {recommendation.title}
                </p>
                <p className="text-muted-foreground">Estimated monthly impact: ${recommendation.estimatedMonthlyImpact.toFixed(2)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="p-0">
        <div className="border-b p-4">
          <h2 className="font-medium">Top 3 products losing money</h2>
          <p className="text-sm text-muted-foreground">Focus these first to stop profit drag.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Product</th>
              <th className="p-2 text-right">Net profit</th>
              <th className="p-2 text-right">Margin %</th>
              <th className="p-2 text-left">Primary reason</th>
            </tr>
          </thead>
          <tbody>
            {data.topLosingProducts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-3 text-center text-muted-foreground">
                  No losing products in this period.
                </td>
              </tr>
            ) : (
              data.topLosingProducts.map((product) => (
                <tr key={product.productId} className="border-t">
                  <td className="p-2">{product.productTitle}</td>
                  <td className="p-2 text-right">${product.netProfit.toFixed(2)}</td>
                  <td className="p-2 text-right">{(product.marginPercent * 100).toFixed(1)}%</td>
                  <td className="p-2">{product.primaryReason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
