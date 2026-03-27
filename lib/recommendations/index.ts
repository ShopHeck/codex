export type RecommendationCategory = "Cut" | "Fix" | "Scale" | "Add";

export type Recommendation = {
  title: string;
  category: RecommendationCategory;
  targetEntity: string;
  summary: string;
  why: string[];
  estimatedMonthlyImpact: number;
  confidenceScore: number;
  actionCta: string;
};

export type RecommendationProduct = {
  productId: string;
  productTitle: string;
  revenue: number;
  netProfit: number;
  margin: number;
  refundRate: number;
  shippingBurden: number;
  adAdjustedMargin: number;
  status: "Scale" | "Healthy" | "Needs Fix" | "Cut Candidate";
};

export type RecommendationLeak = {
  key: "refund" | "shipping" | "discount" | "fee" | "ad";
  label: "Refund Leak" | "Shipping Leak" | "Discount Leak" | "Fee Leak" | "Ad Leak";
  amount: number;
  percentOfRevenue: number;
};

export type RecommendationRuleContext = {
  products: RecommendationProduct[];
  leaks: RecommendationLeak[];
  confidenceScore: number;
  monthlyFactor: number;
};

import { buildAddRecommendations } from "./addRules";
import { buildCutRecommendations } from "./cutRules";
import { buildFixRecommendations } from "./fixRules";
import { buildScaleRecommendations } from "./scaleRules";

export function buildRecommendations(context: RecommendationRuleContext): Recommendation[] {
  return [
    ...buildCutRecommendations(context),
    ...buildFixRecommendations(context),
    ...buildScaleRecommendations(context),
    ...buildAddRecommendations(context)
  ]
    .filter((recommendation) => recommendation.estimatedMonthlyImpact > 0)
    .sort((a, b) => b.estimatedMonthlyImpact - a.estimatedMonthlyImpact);
}
