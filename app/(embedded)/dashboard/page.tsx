import { ProfitChart } from "@/components/charts/profit-chart";
import { KpiCards } from "@/components/layout/kpi-cards";
import { Card } from "@/components/ui/card";

async function getDashboardData() {
  const res = await fetch(`${process.env.APP_URL}/api/dashboard`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Real Profit Dashboard</h1>
      <KpiCards kpis={data?.kpis} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Daily Net Profit</h2>
          <ProfitChart points={data?.daily ?? []} />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Cost Breakdown</h2>
          <ul className="space-y-2 text-sm">
            {(data?.costBreakdown ?? []).map((row: { label: string; value: number }) => (
              <li key={row.label} className="flex justify-between border-b pb-1">
                <span>{row.label}</span>
                <span>${row.value.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
