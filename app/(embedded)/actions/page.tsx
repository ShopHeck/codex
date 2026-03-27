import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { getStoreInsights } from "@/lib/services/insights";

const RECOMMENDATION_CATEGORIES = ["Cut", "Fix", "Scale", "Add"] as const;

export default async function ActionsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/install");

  const data = await getStoreInsights(session.storeId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AI Actions</h1>

      {RECOMMENDATION_CATEGORIES.map((category) => {
        const recommendations = data.recommendations.filter((recommendation) => recommendation.category === category);

        return (
          <section key={category} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{category}</h2>
              <span className="text-sm text-muted-foreground">{recommendations.length} recommendations</span>
            </div>

            {recommendations.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">No {category.toLowerCase()} recommendations right now.</Card>
            ) : (
              <div className="grid gap-3">
                {recommendations.map((recommendation) => (
                  <Card key={recommendation.title} className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium">{recommendation.title}</h3>
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs">Confidence {recommendation.confidenceScore}/100</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Target: {recommendation.targetEntity}</p>
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
            )}
          </section>
        );
      })}
    </div>
  );
}
