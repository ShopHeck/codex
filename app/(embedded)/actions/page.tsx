import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";

export default async function ActionsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/install");

  const data = await getStoreInsights(session.storeId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">AI Actions</h1>
      <div className="grid gap-3">
        {data.recommendations.map((recommendation) => (
          <Card key={recommendation.title} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">{recommendation.title}</h2>
              <span className="rounded bg-gray-100 px-2 py-1 text-xs">{recommendation.category}</span>
            </div>
            <p className="text-sm text-muted-foreground">{recommendation.summary}</p>
            <ul className="list-disc pl-5 text-sm">
              {recommendation.why.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="text-sm font-medium">Estimated monthly impact: ${recommendation.estimatedMonthlyImpact.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Action: {recommendation.actionCta}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
