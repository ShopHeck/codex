import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";

export default async function LeaksPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/install");

  const data = await getStoreInsights(session.storeId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Leak Detection</h1>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Leak</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">% of Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.leaks.map((leak) => (
              <tr key={leak.label} className="border-t">
                <td className="p-2">{leak.label}</td>
                <td className="p-2 text-right">${leak.value.toFixed(2)}</td>
                <td className="p-2 text-right">{(leak.ratio * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
