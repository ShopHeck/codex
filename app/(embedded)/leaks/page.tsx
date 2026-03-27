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

export default async function LeaksPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/install");

  const data = await getStoreInsights(session.storeId);
  const rankedLeaks = [...data.leaks].sort((a, b) => b.amount - a.amount);
  const biggestLeak = rankedLeaks[0];
  const topIssues = rankedLeaks.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leak Analysis</h1>
        <p className="text-sm text-muted-foreground">Operator view of cost leaks ranked by money impact and urgency.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {rankedLeaks.map((leak) => (
          <Card key={leak.key} className="space-y-2 p-4">
            <p className="text-sm font-medium text-muted-foreground">{leak.label}</p>
            <p className="text-2xl font-semibold">{formatCurrency(leak.amount)}</p>
            <p className="text-sm text-muted-foreground">{formatPercent(leak.percentOfRevenue)} of revenue</p>
          </Card>
        ))}
      </section>

      {biggestLeak && (
        <Card className="space-y-2 border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Biggest leak</p>
          <h2 className="text-xl font-semibold text-red-900">{biggestLeak.label}</h2>
          <p className="text-sm text-red-800">
            {formatCurrency(biggestLeak.amount)} ({formatPercent(biggestLeak.percentOfRevenue)} of revenue)
          </p>
          <p className="text-sm text-red-800">{biggestLeak.issueSummary}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-0">
          <div className="border-b p-4">
            <h2 className="font-medium">Ranked Issues</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Issue</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-right">% Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rankedLeaks.map((leak, index) => (
                <tr key={leak.key} className="border-t">
                  <td className="p-3">#{index + 1}</td>
                  <td className="p-3">{leak.label}</td>
                  <td className="p-3 text-right">{formatCurrency(leak.amount)}</td>
                  <td className="p-3 text-right">{formatPercent(leak.percentOfRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-0">
          <div className="border-b p-4">
            <h2 className="font-medium">Projected Impact (Top Issues)</h2>
          </div>
          <div className="space-y-3 p-4">
            {topIssues.map((leak) => (
              <div key={`${leak.key}-impact`} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{leak.label}</p>
                  <p className="font-semibold">{formatCurrency(leak.impactEstimate)}/month</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{leak.issueSummary}</p>
              </div>
            ))}
            {topIssues.length === 0 && (
              <p className="text-sm text-muted-foreground">No leak issues available for this date range.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
