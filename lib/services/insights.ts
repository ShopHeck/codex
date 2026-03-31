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
  appCostAllocation: number;
  adSpendAllocation: number;
  otherCosts: number;
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
  discounts: number;
  refunds: number;
  cogs: number;
  shipping: number;
  fees: number;
  adSpend: number;
  variableCosts: number;
  netProfit: number;
  marginPercent: number;
  refundRate: number;
  shippingBurden: number;
  adAdjustedMargin: number;
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

export type LosingProductInsight = {
  productId: string;
  productTitle: string;
  netProfit: number;
  marginPercent: number;
  primaryReason: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const SCALE_MIN_MARGIN = 0.25;
const HEALTHY_MIN_MARGIN = 0.12;
const CUT_MAX_MARGIN = 0;
const SCALE_MAX_REFUND_RATE = 0.05;
const HIGH_SHIPPING_BURDEN = 0.15;
const HIGH_DISCOUNT_BURDEN = 0.2;
const HIGH_REFUND_RATE = 0.08;

function getPrimaryProfitDrag(product: {
  netProfit: number;
  shippingBurden: number;
  refundRate: number;
  discounts: number;
  fees: number;
  adSpend: number;
  revenue: number;
}) {
  if (product.netProfit >= 0) return "Not losing money";

  const feeBurden = product.revenue > 0 ? product.fees / product.revenue : 0;
  const adBurden = product.revenue > 0 ? product.adSpend / product.revenue : 0;
  const discountBurden = product.revenue > 0 ? product.discounts / product.revenue : 0;

  return [
    { label: "High shipping cost burden", value: product.shippingBurden },
    { label: "High refund rate", value: product.refundRate },
    { label: "Heavy discounting", value: discountBurden },
    { label: "Platform/payment fees", value: feeBurden },
    { label: "Ad spend outweighing contribution", value: adBurden }
  ].sort((a, b) => b.value - a.value)[0]?.label;
}

export function getProductStatus(product: {
  marginPercent: number;
  refundRate: number;
  shippingBurden: number;
  discountBurden?: number;
  netProfit: number;
}): ProductInsight["status"] {
  if (product.marginPercent <= CUT_MAX_MARGIN || product.netProfit <= 0) return "Cut Candidate";
  if (product.marginPercent >= SCALE_MIN_MARGIN && product.refundRate < SCALE_MAX_REFUND_RATE) return "Scale";

  const discountBurden = product.discountBurden ?? 0;
  const hasElevatedLeaks =
    product.shippingBurden >= HIGH_SHIPPING_BURDEN ||
    discountBurden >= HIGH_DISCOUNT_BURDEN ||
    product.refundRate >= HIGH_REFUND_RATE;

  if (product.marginPercent >= HEALTHY_MIN_MARGIN && !hasElevatedLeaks) return "Healthy";
  return "Needs Fix";
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
    const totalItemQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

    for (const item of order.items) {
      const key = item.productId ?? item.title;
      const existing = productMap.get(key) ?? {
        productId: key,
        productTitle: item.title,
        revenue: 0,
        discounts: 0,
        refunds: 0,
        cogs: 0,
        shipping: 0,
        fees: 0,
        adSpend: 0,
        variableCosts: 0,
        netProfit: 0,
        marginPercent: 0,
        refundRate: 0,
        shippingBurden: 0,
        adAdjustedMargin: 0,
        status: "Healthy"
      };

      const share =
        totalItemRevenue > 0
          ? item.totalRevenue / totalItemRevenue
          : totalItemQuantity > 0
            ? item.quantity / totalItemQuantity
            : 0;
      const discountAllocated = order.discounts * share;
      const refundsAllocated = order.refunds * share;
      const shippingAllocated = order.shippingCost * share;
      const feesAllocated = (order.paymentFees + order.shopifyFees) * share;
      const adSpendAllocated = order.adSpendAllocation * share;
      const variableCostAllocated = (order.otherCosts + order.appCostAllocation) * share;
      existing.revenue += item.totalRevenue;
      existing.discounts += discountAllocated;
      existing.refunds += refundsAllocated;
      existing.cogs += item.totalCogs;
      existing.shipping += shippingAllocated;
      existing.fees += feesAllocated;
      existing.adSpend += adSpendAllocated;
      existing.variableCosts += variableCostAllocated;
      productMap.set(key, existing);
    }
  }

  const products = Array.from(productMap.values())
    .map((product) => {
      const netProfit =
        product.revenue -
        product.discounts -
        product.refunds -
        product.cogs -
        product.shipping -
        product.fees -
        product.adSpend -
        product.variableCosts;
      const marginPercent = product.revenue > 0 ? netProfit / product.revenue : 0;
      const refundRate = product.revenue > 0 ? product.refunds / product.revenue : 0;
      const shippingBurden = product.revenue > 0 ? product.shipping / product.revenue : 0;
      const discountBurden = product.revenue > 0 ? product.discounts / product.revenue : 0;
      const adAdjustedMargin = product.revenue > 0 ? (netProfit + product.adSpend) / product.revenue : 0;

      return {
        ...product,
        netProfit,
        marginPercent,
        refundRate,
        shippingBurden,
        adAdjustedMargin,
        status: getProductStatus({ marginPercent, refundRate, shippingBurden, discountBurden, netProfit })
      };
    })
    .sort((a, b) => b.netProfit - a.netProfit);

  const monthlyFactor = getMonthlyFactor(typedOrders);

  const leakRows = [
    { label: "Refund Leak", value: typedOrders.reduce((sum, order) => sum + order.refunds, 0) },
    { label: "Shipping Leak", value: typedOrders.reduce((sum, order) => sum + order.shippingCost, 0) },
    { label: "Discount Leak", value: typedOrders.reduce((sum, order) => sum + order.discounts, 0) },
    {
      label: "Fee Leak",
      value: typedOrders.reduce((sum, order) => sum + order.paymentFees + order.shopifyFees, 0)
    },
    { label: "Ad Leak", value: typedOrders.reduce((sum, order) => sum + order.adSpendAllocation, 0) }
  ].map((row) => {
    const ratio = revenue > 0 ? row.value / revenue : 0;
    return { ...row, ratio, projectedImpact: row.value * 0.2 * monthlyFactor };
  });

  const recommendations: Recommendation[] = [];

  for (const product of products.filter((product) => product.status === "Cut Candidate").slice(0, 2)) {
    const impact = Math.abs(product.netProfit) * monthlyFactor;
    recommendations.push({
      title: `Cut or relaunch ${product.productTitle}`,
      category: "Cut",
      targetEntity: product.productTitle,
      summary: `${product.productTitle} is currently losing contribution profit.`,
      why: [
        `Margin is ${(product.marginPercent * 100).toFixed(1)}%.`,
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
        `Margin is ${(scaleProduct.marginPercent * 100).toFixed(1)}%.`,
        `A 15% volume lift could add $${impact.toFixed(2)}/month.`
      ],
      estimatedMonthlyImpact: impact,
      confidenceScore,
      actionCta: "Increase budget and inventory coverage"
    });
  }

  const topLosingProducts: LosingProductInsight[] = products
    .filter((product) => product.netProfit < 0)
    .sort((a, b) => a.netProfit - b.netProfit)
    .slice(0, 3)
    .map((product) => ({
      productId: product.productId,
      productTitle: product.productTitle,
      netProfit: product.netProfit,
      marginPercent: product.marginPercent,
      primaryReason: getPrimaryProfitDrag(product) ?? "Combined cost pressure"
    }));

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
    topLosingProducts,
    leaks: leakRows,
    recommendations: recommendations
      .filter((recommendation) => recommendation.estimatedMonthlyImpact > 0)
      .sort((a, b) => b.estimatedMonthlyImpact - a.estimatedMonthlyImpact)
  };
}
