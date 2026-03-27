import { redirect } from "next/navigation";
import { ProfitChart } from "@/components/charts/profit-chart";
import { KpiCards } from "@/components/layout/kpi-cards";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/shopify/session";

async function getDashboardData(storeId: string) {
  const [orders, snapshots] = await Promise.all([
    prisma.order.findMany({ where: { storeId } }),
    prisma.dailyProfitSnapshot.findMany({ where: { storeId }, orderBy: { date: "asc" }, take: 30 })
  ]);

  const revenue = orders.reduce((sum: number, order: { revenue: number }) => sum + order.revenue, 0);
  const totalCosts = orders.reduce((sum: number, order: { totalCosts: number }) => sum + order.totalCosts, 0);
  const netProfit = revenue - totalCosts;

  return {
    kpis: { revenue, totalCosts, netProfit, netMargin: revenue ? netProfit / revenue : 0 },
    daily: snapshots.map((snapshot: { date: Date; netProfit: number }) => ({ date: snapshot.date.toISOString().slice(5, 10), netProfit: snapshot.netProfit })),
    costBreakdown: [
      { label: "COGS", value: orders.reduce((acc: number, order: { cogs: number }) => acc + order.cogs, 0) },
      { label: "Payment Fees", value: orders.reduce((acc: number, order: { paymentFees: number }) => acc + order.paymentFees, 0) },
      { label: "Shopify Fees", value: orders.reduce((acc: number, order: { shopifyFees: number }) => acc + order.shopifyFees, 0) },
      { label: "Shipping", value: orders.reduce((acc: number, order: { shippingCost: number }) => acc + order.shippingCost, 0) },
      { label: "Ads", value: orders.reduce((acc: number, order: { adSpendAllocation: number }) => acc + order.adSpendAllocation, 0) }
    ]
  };
}

export default async function DashboardPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/install");
  }

  const data = await getDashboardData(session.storeId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Real Profit Dashboard</h1>
      <KpiCards kpis={data.kpis} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Daily Net Profit</h2>
          <ProfitChart points={data.daily} />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Cost Breakdown</h2>
          <ul className="space-y-2 text-sm">
            {data.costBreakdown.map((row) => (
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
