import type { Recommendation, RecommendationRuleContext } from "./index";

export function buildAddRecommendations(context: RecommendationRuleContext): Recommendation[] {
  const anchorProduct = context.products
    .filter((product) => product.status === "Scale" || product.status === "Healthy")
    .sort((a, b) => b.netProfit - a.netProfit)[0];

  if (!anchorProduct || anchorProduct.netProfit <= 0) {
    return [];
  }

  const impact = anchorProduct.netProfit * 0.1 * context.monthlyFactor;

  return [
    {
      title: `Add adjacent offer for ${anchorProduct.productTitle}`,
      category: "Add",
      targetEntity: anchorProduct.productTitle,
      summary: `Launch a complementary SKU to increase average order value around ${anchorProduct.productTitle}.`,
      why: [
        `${anchorProduct.productTitle} has ${(anchorProduct.margin * 100).toFixed(1)}% margin, validating demand quality.`,
        `A conservative add-on attach rate could contribute about $${impact.toFixed(2)}/month.`
      ],
      estimatedMonthlyImpact: impact,
      confidenceScore: context.confidenceScore,
      actionCta: "Test one complementary bundle or add-on this month"
    }
  ];
}
