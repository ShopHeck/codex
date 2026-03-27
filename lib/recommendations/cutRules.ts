import type { Recommendation, RecommendationRuleContext } from "./index";

export function buildCutRecommendations(context: RecommendationRuleContext): Recommendation[] {
  return context.products
    .filter((product) => product.status === "Cut Candidate")
    .sort((a, b) => a.netProfit - b.netProfit)
    .slice(0, 2)
    .map((product) => {
      const impact = Math.abs(product.netProfit) * context.monthlyFactor;
      return {
        title: `Cut or relaunch ${product.productTitle}`,
        category: "Cut",
        targetEntity: product.productTitle,
        summary: `${product.productTitle} is currently losing contribution profit.`,
        why: [
          `Margin is ${(product.margin * 100).toFixed(1)}%.`,
          `Estimated monthly drag is $${impact.toFixed(2)}.`
        ],
        estimatedMonthlyImpact: impact,
        confidenceScore: context.confidenceScore,
        actionCta: "Pause ads and review pricing/COGS"
      } satisfies Recommendation;
    });
}
