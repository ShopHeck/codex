import { prisma } from "@/lib/prisma";
import { buildRecommendations, type Recommendation } from "@/lib/recommendations";

type OrderWithItems = {
  id: string;
  orderDate: Date;
  revenue: number;
  discounts: number;
  refunds: number;
  cogs: number;
  shippingCost: number;
  paymentFees: number;
  shopifyFees: number;
  adSpendAllocation: number;
  totalCosts: number;
  netProfit: number;
  items: Array<{
    productId: string | null;
    title: string;
    quantity: number;
    cogsPerUnit: number;
    totalRevenue: number;
    totalCogs: number;
    discountAllocated: number;
    refundAllocated: number;
    shippingAllocated: number;
    adSpendAllocated: number;
    variableCostAllocated: number;
    feeAllocated: number;
    netProfit: number;
  }>;
};

export type ProductInsight = {
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

type ProductAccumulator = ProductInsight & {
  refundAllocated: number;
  shippingAllocated: number;
  adSpendAllocated: number;
};



export type LeakInsight = {
  key: "refund" | "shipping" | "discount" | "fee" | "ad";
  label: "Refund Leak" | "Shipping Leak" | "Discount Leak" | "Fee Leak" | "Ad Leak";
  amount: number;
  percentOfRevenue: number;
  issueSummary: string;
  impactEstimate: number;
  // Backward-compatible aliases.
  value: number;
  ratio: number;
};

const LEAK_DEFAULT_THRESHOLDS: Record<LeakInsight["key"], number> = {
  refund: 0.08,
  shipping: 0.15,
  discount: 0.2,
  fee: 0.06,
  ad: 0.12
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getProductStatus(
  margin: number,
  refundRate = 0,
  shippingBurden = 0
): ProductInsight["status"] {
  if (margin <= 0) return "Cut Candidate";
  if (margin < 0.12 || refundRate >= 0.05 || shippingBurden >= 0.15) return "Needs Fix";
  if (margin >= 0.25 && refundRate < 0.05) return "Scale";
  return "Healthy";
}

function getMonthlyFactor(orders: OrderWithItems[]) {
  if (!orders.length) return 1;
  const timestamps = orders.map((order) => order.orderDate.getTime());
  const rangeDays = Math.max(1, Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / 86400000) + 1);
  return 30 / rangeDays;
}

function buildLeakInsight(
  key: LeakInsight["key"],
  label: LeakInsight["label"],
  amount: number,
  revenue: number,
  monthlyFactor: number
): LeakInsight {
  const percentOfRevenue = revenue > 0 ? amount / revenue : 0;
  const threshold = LEAK_DEFAULT_THRESHOLDS[key];

  let issueSummary = `${label} is within the expected range.`;
  if (percentOfRevenue >= threshold) {
    issueSummary = `${label} exceeds the ${(threshold * 100).toFixed(0)}% threshold and is compressing contribution profit.`;
  } else if (percentOfRevenue >= threshold * 0.75) {
    issueSummary = `${label} is near the ${(threshold * 100).toFixed(0)}% threshold and should be monitored.`;
  }

  const excessPercent = Math.max(percentOfRevenue - threshold, 0);
  const impactEstimate = revenue * excessPercent * monthlyFactor;

  return {
    key,
    label,
    amount,
    percentOfRevenue,
    issueSummary,
    impactEstimate,
    value: amount,
    ratio: percentOfRevenue
  };
}

export async function getStoreInsights(storeId: string) {
  const [store, orders, dailySnapshots, adEntriesInLast30] = await Promise.all([
    prisma.shopifyStore.findUnique({ where: { id: storeId } }),
    prisma.order.findMany({
      where: { storeId },
      include: { items: true },
      orderBy: { orderDate: "asc" }
    }),
    prisma.dailyProfitSnapshot.findMany({
      where: { storeId },
      orderBy: { date: "asc" },
      take: 30
    }),
    prisma.adSpendEntry.count({
      where: {
        storeId,
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })
  ]);

  if (!store) {
    throw new Error("Store not found");
  }

  const typedOrders = orders as OrderWithItems[];
  const revenue = typedOrders.reduce((sum, order) => sum + order.revenue, 0);
  const totalCosts = typedOrders.reduce((sum, order) => sum + order.totalCosts, 0);
  const netProfit = revenue - totalCosts;

  let confidenceScore = 100;
  if (typedOrders.some((order) => order.items.some((item) => item.cogsPerUnit <= 0))) confidenceScore -= 25;
  if (typedOrders.some((order) => order.shippingCost <= 0)) confidenceScore -= 10;
  if (typedOrders.length > 0 && adEntriesInLast30 === 0) confidenceScore -= 15;
  if (store.paymentFeePercent <= 0 || store.shopifyFeePercent < 0) confidenceScore -= 10;
  if (typedOrders.some((order) => order.refunds > 0 && order.items.length === 0)) confidenceScore -= 10;
  confidenceScore = clamp(confidenceScore, 0, 100);

  const confidenceBand =
    confidenceScore >= 90
      ? "Accurate"
      : confidenceScore >= 75
        ? "Good estimate"
        : confidenceScore >= 50
          ? "Usable but incomplete"
          : "Low confidence";

  const productMap = new Map<string, ProductAccumulator>();
  for (const order of typedOrders) {
    for (const item of order.items) {
      const key = item.productId ?? item.title;
      const existing = productMap.get(key) ?? {
        productId: key,
        productTitle: item.title,
        revenue: 0,
        netProfit: 0,
        margin: 0,
        refundRate: 0,
        shippingBurden: 0,
        adAdjustedMargin: 0,
        status: "Healthy",
        refundAllocated: 0,
        shippingAllocated: 0,
        adSpendAllocated: 0
      };

      existing.revenue += item.totalRevenue;
      existing.netProfit += item.netProfit;
      existing.refundAllocated += item.refundAllocated;
      existing.shippingAllocated += item.shippingAllocated;
      existing.adSpendAllocated += item.adSpendAllocated;

      existing.margin = existing.revenue > 0 ? existing.netProfit / existing.revenue : 0;
      existing.refundRate = existing.revenue > 0 ? existing.refundAllocated / existing.revenue : 0;
      existing.shippingBurden = existing.revenue > 0 ? existing.shippingAllocated / existing.revenue : 0;
      existing.adAdjustedMargin =
        existing.revenue > 0 ? (existing.netProfit + existing.adSpendAllocated) / existing.revenue : 0;
      existing.status = getProductStatus(existing.margin, existing.refundRate, existing.shippingBurden);
      productMap.set(key, existing);
    }
  }

  const products: ProductInsight[] = Array.from(productMap.values())
    .map(
      ({ refundAllocated: _refundAllocated, shippingAllocated: _shippingAllocated, adSpendAllocated: _adSpendAllocated, ...product }) =>
        product
    )
    .sort((a, b) => b.netProfit - a.netProfit);

  const monthlyFactor = getMonthlyFactor(typedOrders);
  const leaks: LeakInsight[] = [
    buildLeakInsight("refund", "Refund Leak", typedOrders.reduce((sum, order) => sum + order.refunds, 0), revenue, monthlyFactor),
    buildLeakInsight(
      "shipping",
      "Shipping Leak",
      typedOrders.reduce((sum, order) => sum + order.shippingCost, 0),
      revenue,
      monthlyFactor
    ),
    buildLeakInsight(
      "discount",
      "Discount Leak",
      typedOrders.reduce((sum, order) => sum + order.discounts, 0),
      revenue,
      monthlyFactor
    ),
    buildLeakInsight(
      "fee",
      "Fee Leak",
      typedOrders.reduce((sum, order) => sum + order.paymentFees + order.shopifyFees, 0),
      revenue,
      monthlyFactor
    ),
    buildLeakInsight(
      "ad",
      "Ad Leak",
      typedOrders.reduce((sum, order) => sum + order.adSpendAllocation, 0),
      revenue,
      monthlyFactor
    )
  ];

  const recommendations: Recommendation[] = buildRecommendations({
    products,
    leaks,
    confidenceScore,
    monthlyFactor
  });

  return {
    kpis: {
      revenue,
      totalCosts,
      netProfit,
      netMargin: revenue > 0 ? netProfit / revenue : 0,
      profitPerOrder: typedOrders.length > 0 ? netProfit / typedOrders.length : 0,
      revenueProfitGap: revenue - netProfit
    },
    confidence: {
      score: confidenceScore,
      band: confidenceBand
    },
    daily: dailySnapshots.map((snapshot: { date: Date; netProfit: number }) => ({
      date: snapshot.date.toISOString().slice(5, 10),
      netProfit: snapshot.netProfit
    })),
    products,
    leaks,
    recommendations
  };
}
