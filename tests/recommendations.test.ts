import { describe, expect, it } from "vitest";
import { buildRecommendations, type RecommendationRuleContext } from "@/lib/recommendations";

const baseContext: RecommendationRuleContext = {
  confidenceScore: 88,
  monthlyFactor: 1,
  products: [
    {
      productId: "p1",
      productTitle: "Loss Leader",
      revenue: 1000,
      netProfit: -120,
      margin: -0.12,
      refundRate: 0.03,
      shippingBurden: 0.14,
      adAdjustedMargin: -0.05,
      status: "Cut Candidate"
    },
    {
      productId: "p2",
      productTitle: "Winner",
      revenue: 3000,
      netProfit: 900,
      margin: 0.3,
      refundRate: 0.02,
      shippingBurden: 0.08,
      adAdjustedMargin: 0.35,
      status: "Scale"
    }
  ],
  leaks: [
    { key: "shipping", label: "Shipping Leak", amount: 800, percentOfRevenue: 0.22 },
    { key: "discount", label: "Discount Leak", amount: 300, percentOfRevenue: 0.1 },
    { key: "refund", label: "Refund Leak", amount: 100, percentOfRevenue: 0.03 },
    { key: "fee", label: "Fee Leak", amount: 120, percentOfRevenue: 0.04 },
    { key: "ad", label: "Ad Leak", amount: 200, percentOfRevenue: 0.07 }
  ]
};

describe("recommendation rules", () => {
  it("builds deterministic category recommendations with required fields", () => {
    const recommendations = buildRecommendations(baseContext);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(new Set(recommendations.map((recommendation) => recommendation.category))).toEqual(
      new Set(["Cut", "Fix", "Scale", "Add"])
    );

    for (const recommendation of recommendations) {
      expect(recommendation.title.length).toBeGreaterThan(0);
      expect(recommendation.targetEntity.length).toBeGreaterThan(0);
      expect(recommendation.summary.length).toBeGreaterThan(0);
      expect(recommendation.why.length).toBeGreaterThan(0);
      expect(recommendation.estimatedMonthlyImpact).toBeGreaterThan(0);
      expect(recommendation.confidenceScore).toBe(baseContext.confidenceScore);
      expect(recommendation.actionCta.length).toBeGreaterThan(0);
    }
  });
});
