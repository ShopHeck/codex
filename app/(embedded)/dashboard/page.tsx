import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function getConfidenceClasses(score: number) {
  if (score >= 90) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 75) return "border-blue-200 bg-blue-50 text-blue-700";
  if (score >= 50) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export default async function DashboardPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/install");
  }

  const data = await getStoreInsights(session.storeId);

  const leakByLabel = Object.fromEntries(data.leaks.map((leak) => [leak.label, leak.value]));
  const refundLoss = leakByLabel["Refund Leak"] ?? 0;
  const shippingLoss = leakByLabel["Shipping Leak"] ?? 0;
  const discountLoss = leakByLabel["Discount Leak"] ?? 0;
  const feeLoss = leakByLabel["Fee Leak"] ?? 0;
  const adLoss = leakByLabel["Ad Leak"] ?? 0;

  const topProfitableProducts = data.products.filter((product) => product.netProfit > 0).slice(0, 5);
  const topDestroyingProducts = data.products
    .filter((product) => product.netProfit < 0)
    .sort((a, b) => a.netProfit - b.netProfit)
    .slice(0, 5);

  const revenueVsProfitMax = Math.max(data.kpis.revenue, Math.max(data.kpis.netProfit, 0), 1);

  const waterfallRows = [
    { label: "Revenue", value: data.kpis.revenue, type: "positive" as const },
    { label: "Discounts", value: discountLoss, type: "negative" as const },
    { label: "Refunds", value: refundLoss, type: "negative" as const },
    { label: "Shipping", value: shippingLoss, type: "negative" as const },
    { label: "Fees", value: feeLoss, type: "negative" as const },
    { label: "Ad Spend", value: adLoss, type: "negative" as const },
    {
      label: "Other Variable Costs",
      value: Math.max(data.kpis.totalCosts - (discountLoss + refundLoss + shippingLoss + feeLoss + adLoss), 0),
      type: "negative" as const
    },
    { label: "Net Profit", value: data.kpis.netProfit, type: "total" as const }
  ];

  const waterfallScale = Math.max(...waterfallRows.map((row) => Math.abs(row.value)), 1);
  const aiActions = data.recommendations.slice(0, 3);
  const totalActionImpact = aiActions.reduce((sum, action) => sum + action.estimatedMonthlyImpact, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">Real profit clarity across leaks, products, and action priorities.</p>
        </div>
        <div className={`rounded-full border px-3 py-1 text-sm font-medium ${getConfidenceClasses(data.confidence.score)}`}>
          Confidence: {data.confidence.score}/100 · {data.confidence.band}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Net Profit", value: formatCurrency(data.kpis.netProfit) },
          { label: "Net Margin %", value: formatPercent(data.kpis.netMargin) },
          { label: "Profit per Order", value: formatCurrency(data.kpis.profitPerOrder) },
          { label: "Revenue vs Profit Gap", value: formatCurrency(data.kpis.revenueProfitGap) }
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Refund Loss", value: refundLoss, ratio: data.kpis.revenue > 0 ? refundLoss / data.kpis.revenue : 0 },
          { label: "Shipping Loss", value: shippingLoss, ratio: data.kpis.revenue > 0 ? shippingLoss / data.kpis.revenue : 0 },
          { label: "Discount Loss", value: discountLoss, ratio: data.kpis.revenue > 0 ? discountLoss / data.kpis.revenue : 0 }
        ].map((leak) => (
          <Card key={leak.label} className="p-4">
            <p className="text-sm text-muted-foreground">{leak.label}</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(leak.value)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatPercent(leak.ratio)} of revenue</p>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 p-4">
          <h2 className="font-medium">Revenue vs Net Profit</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Revenue", value: data.kpis.revenue, color: "bg-slate-700" },
              { label: "Net Profit", value: data.kpis.netProfit, color: "bg-emerald-600" }
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-2 h-44 rounded bg-slate-100 p-3">
                  <div className={`h-full rounded ${row.color}`} style={{ width: `${Math.max((Math.max(row.value, 0) / revenueVsProfitMax) * 100, 4)}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">{row.label}</p>
                <p className="font-medium">{formatCurrency(row.value)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-medium">Profit Waterfall Breakdown</h2>
          <div className="space-y-2">
            {waterfallRows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={row.type === "negative" ? "text-red-600" : "text-foreground"}>
                    {row.type === "negative" ? "-" : ""}
                    {formatCurrency(Math.abs(row.value))}
                  </span>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div
                    className={`h-full rounded ${
                      row.type === "negative" ? "bg-red-500" : row.type === "total" ? "bg-emerald-600" : "bg-slate-700"
                    }`}
                    style={{ width: `${Math.max((Math.abs(row.value) / waterfallScale) * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-0">
          <div className="border-b p-4">
            <h2 className="font-medium">Top Profitable Products</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Net Profit</th>
                <th className="p-3 text-right">Margin</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {topProfitableProducts.map((product) => (
                <tr key={product.productId} className="border-t">
                  <td className="p-3">{product.productTitle}</td>
                  <td className="p-3 text-right">{formatCurrency(product.netProfit)}</td>
                  <td className="p-3 text-right">{formatPercent(product.margin)}</td>
                  <td className="p-3 text-right">{product.status}</td>
                </tr>
              ))}
              {topProfitableProducts.length === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={4}>
                    No profitable products in the selected data window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-0">
          <div className="border-b p-4">
            <h2 className="font-medium">Top Products Destroying Profit</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Net Loss</th>
                <th className="p-3 text-right">Margin</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {topDestroyingProducts.map((product) => (
                <tr key={product.productId} className="border-t">
                  <td className="p-3">{product.productTitle}</td>
                  <td className="p-3 text-right text-red-600">{formatCurrency(product.netProfit)}</td>
                  <td className="p-3 text-right">{formatPercent(product.margin)}</td>
                  <td className="p-3 text-right">{product.status}</td>
                </tr>
              ))}
              {topDestroyingProducts.length === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={4}>
                    No products are currently destroying profit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">AI Summary: Top 3 Actions</h2>
          <p className="text-sm font-medium">Total potential monthly impact: {formatCurrency(totalActionImpact)}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {aiActions.map((action) => (
            <div key={action.title} className="space-y-2 rounded border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-slate-100 px-2 py-1 text-xs">{action.category}</span>
                <span className="text-xs text-muted-foreground">Confidence {action.confidenceScore}/100</span>
              </div>
              <p className="font-medium">{action.title}</p>
              <p className="text-sm text-muted-foreground">{action.summary}</p>
              <p className="text-sm font-medium">Impact: {formatCurrency(action.estimatedMonthlyImpact)}/mo</p>
            </div>
          ))}
          {aiActions.length === 0 && (
            <div className="rounded border p-3 text-sm text-muted-foreground">No actions available yet. Sync more data to generate impact recommendations.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
