import type { Recommendation, RecommendationRuleContext } from "./index";

export function buildScaleRecommendations(context: RecommendationRuleContext): Recommendation[] {
  return context.products
    .filter((product) => product.status === "Scale" && product.netProfit > 0)
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 2)
    .map((product) => {
      const impact = product.netProfit * 0.15 * context.monthlyFactor;
      return {
        title: `Scale ${product.productTitle}`,
        category: "Scale",
        targetEntity: product.productTitle,
        summary: `${product.productTitle} is a strong performer with healthy margin.`,
        why: [
          `Margin is ${(product.margin * 100).toFixed(1)}%.`,
          `A 15% volume lift could add $${impact.toFixed(2)}/month.`
        ],
        estimatedMonthlyImpact: impact,
        confidenceScore: context.confidenceScore,
        actionCta: "Increase budget and inventory coverage"
      } satisfies Recommendation;
    });
}
