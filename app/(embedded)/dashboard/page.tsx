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
    </div>
  );
}
