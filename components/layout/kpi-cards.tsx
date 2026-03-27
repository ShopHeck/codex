import { Card } from "@/components/ui/card";

export function KpiCards({
  kpis = { revenue: 0, totalCosts: 0, netProfit: 0, netMargin: 0 }
}: {
  kpis?: { revenue: number; totalCosts: number; netProfit: number; netMargin: number };
}) {
  const rows = [
    ["Revenue", kpis.revenue],
    ["Total Costs", kpis.totalCosts],
    ["Net Profit", kpis.netProfit],
    ["Net Margin", `${(kpis.netMargin * 100).toFixed(1)}%`]
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {rows.map(([label, value]) => (
        <Card key={String(label)} className="p-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{typeof value === "number" ? `$${value.toFixed(2)}` : value}</p>
        </Card>
      ))}
    </div>
  );
}
