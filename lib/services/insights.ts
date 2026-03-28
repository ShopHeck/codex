import { prisma } from "@/lib/prisma";

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
  }>;
};

export type ProductInsight = {
  productId: string;
  productTitle: string;
  revenue: number;
  totalCosts: number;
  netProfit: number;
  margin: number;
  status: "Scale" | "Healthy" | "Needs Fix" | "Cut Candidate";
};

export type Recommendation = {
  title: string;
  category: "Cut" | "Fix" | "Scale" | "Add";
  targetEntity: string;
  summary: string;
  why: string[];
  estimatedMonthlyImpact: number;
  confidenceScore: number;
  actionCta: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getProductStatus(margin: number): ProductInsight["status"] {
  if (margin <= 0) return "Cut Candidate";
  if (margin < 0.12) return "Needs Fix";
  if (margin >= 0.25) return "Scale";
  return "Healthy";
}

function getMonthlyFactor(orders: OrderWithItems[]) {
  if (!orders.length) return 1;
  const timestamps = orders.map((order) => order.orderDate.getTime());
  const rangeDays = Math.max(1, Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / 86400000) + 1);
  return 30 / rangeDays;
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

  const productMap = new Map<string, ProductInsight>();
  for (const order of typedOrders) {
    const totalItemRevenue = order.items.reduce((sum, item) => sum + item.totalRevenue, 0);
    const allocatableNonCogsCosts = Math.max(order.totalCosts - order.cogs, 0);

    for (const item of order.items) {
      const key = item.productId ?? item.title;
      const existing = productMap.get(key) ?? {
        productId: key,
        productTitle: item.title,
        revenue: 0,
        totalCosts: 0,
        netProfit: 0,
        margin: 0,
        status: "Healthy"
      };

      const share = totalItemRevenue > 0 ? item.totalRevenue / totalItemRevenue : 0;
      const allocatedCosts = item.totalCogs + allocatableNonCogsCosts * share;

      existing.revenue += item.totalRevenue;
      existing.totalCosts += allocatedCosts;
      existing.netProfit = existing.revenue - existing.totalCosts;
      existing.margin = existing.revenue > 0 ? existing.netProfit / existing.revenue : 0;
      existing.status = getProductStatus(existing.margin);
      productMap.set(key, existing);
    }
  }

  const products = Array.from(productMap.values()).sort((a, b) => b.netProfit - a.netProfit);

  const leakRows = [
    { label: "Refund Leak", value: typedOrders.reduce((sum, order) => sum + order.refunds, 0) },
    { label: "Shipping Leak", value: typedOrders.reduce((sum, order) => sum + order.shippingCost, 0) },
    { label: "Discount Leak", value: typedOrders.reduce((sum, order) => sum + order.discounts, 0) },
    {
      label: "Fee Leak",
      value: typedOrders.reduce((sum, order) => sum + order.paymentFees + order.shopifyFees, 0)
    },
    { label: "Ad Leak", value: typedOrders.reduce((sum, order) => sum + order.adSpendAllocation, 0) }
  ].map((row) => ({ ...row, ratio: revenue > 0 ? row.value / revenue : 0 }));

  const monthlyFactor = getMonthlyFactor(typedOrders);
  const recommendations: Recommendation[] = [];

  for (const product of products.filter((product) => product.status === "Cut Candidate").slice(0, 2)) {
    const impact = Math.abs(product.netProfit) * monthlyFactor;
    recommendations.push({
      title: `Cut or relaunch ${product.productTitle}`,
      category: "Cut",
      targetEntity: product.productTitle,
      summary: `${product.productTitle} is currently losing contribution profit.`,
      why: [
        `Margin is ${(product.margin * 100).toFixed(1)}%.`,
        `Estimated monthly drag is $${impact.toFixed(2)}.`
      ],
      estimatedMonthlyImpact: impact,
      confidenceScore,
      actionCta: "Pause ads and review pricing/COGS"
    });
  }

  const biggestLeak = leakRows.sort((a, b) => b.value - a.value)[0];
  if (biggestLeak && biggestLeak.ratio > 0.08) {
    const impact = biggestLeak.value * 0.2 * monthlyFactor;
    recommendations.push({
      title: `Fix ${biggestLeak.label.toLowerCase()}`,
      category: "Fix",
      targetEntity: biggestLeak.label,
      summary: `${biggestLeak.label} is materially compressing margin.`,
      why: [
        `${biggestLeak.label} is ${(biggestLeak.ratio * 100).toFixed(1)}% of revenue.`,
        `Recovering 20% would add about $${impact.toFixed(2)}/month.`
      ],
      estimatedMonthlyImpact: impact,
      confidenceScore,
      actionCta: "Apply pricing + ops adjustments"
    });
  }

  const scaleProduct = products.find((product) => product.status === "Scale");
  if (scaleProduct) {
    const impact = Math.max(scaleProduct.netProfit, 0) * 0.15 * monthlyFactor;
    recommendations.push({
      title: `Scale ${scaleProduct.productTitle}`,
      category: "Scale",
      targetEntity: scaleProduct.productTitle,
      summary: `${scaleProduct.productTitle} is a strong performer with healthy margin.`,
      why: [
        `Margin is ${(scaleProduct.margin * 100).toFixed(1)}%.`,
        `A 15% volume lift could add $${impact.toFixed(2)}/month.`
      ],
      estimatedMonthlyImpact: impact,
      confidenceScore,
      actionCta: "Increase budget and inventory coverage"
    });
  }

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
    daily: dailySnapshots.map((snapshot) => ({
      date: snapshot.date.toISOString().slice(5, 10),
      netProfit: snapshot.netProfit
    })),
    products,
    leaks: leakRows,
    recommendations: recommendations
      .filter((recommendation) => recommendation.estimatedMonthlyImpact > 0)
      .sort((a, b) => b.estimatedMonthlyImpact - a.estimatedMonthlyImpact)
  };
}
