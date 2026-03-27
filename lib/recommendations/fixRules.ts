import type { Recommendation, RecommendationRuleContext } from "./index";

const FIX_THRESHOLDS: Record<RecommendationRuleContext["leaks"][number]["key"], number> = {
  refund: 0.08,
  shipping: 0.15,
  discount: 0.2,
  fee: 0.06,
  ad: 0.12
};

export function buildFixRecommendations(context: RecommendationRuleContext): Recommendation[] {
  const leakFixes = context.leaks
    .filter((leak) => leak.percentOfRevenue > FIX_THRESHOLDS[leak.key])
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 1)
    .map((leak) => {
      const impact = leak.amount * 0.2 * context.monthlyFactor;
      return {
        title: `Fix ${leak.label.toLowerCase()}`,
        category: "Fix",
        targetEntity: leak.label,
        summary: `${leak.label} is materially compressing margin.`,
        why: [
          `${leak.label} is ${(leak.percentOfRevenue * 100).toFixed(1)}% of revenue.`,
          `Recovering 20% would add about $${impact.toFixed(2)}/month.`
        ],
        estimatedMonthlyImpact: impact,
        confidenceScore: context.confidenceScore,
        actionCta: "Apply pricing + ops adjustments"
      } satisfies Recommendation;
    });

  const productFixes = context.products
    .filter((product) => product.status === "Needs Fix")
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 1)
    .map((product) => {
      const impact = Math.max(product.revenue * 0.05 * context.monthlyFactor, 0);
      return {
        title: `Fix margin on ${product.productTitle}`,
        category: "Fix",
        targetEntity: product.productTitle,
        summary: `${product.productTitle} has low contribution margin and needs operational tuning.`,
        why: [
          `Current margin is ${(product.margin * 100).toFixed(1)}%.`,
          `A 5-point margin lift could recover about $${impact.toFixed(2)}/month.`
        ],
        estimatedMonthlyImpact: impact,
        confidenceScore: context.confidenceScore,
        actionCta: "Reduce shipping, discount, and fulfillment burden"
      } satisfies Recommendation;
    });

  return [...leakFixes, ...productFixes];
}
