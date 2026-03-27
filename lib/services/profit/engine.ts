import {
  allocateAds,
  allocateDiscounts,
  allocateFees,
  allocatePerOrderVariableCost,
  allocateRefunds,
  allocateShipping,
  buildNetItemAllocations
} from "@/lib/services/profit/allocations";
import type { ConfidenceInputs, ProfitComputation, ProfitInputs } from "@/lib/services/profit/types";

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

function resolveShipping(inputs: ProfitInputs) {
  const exact = sum(inputs.shippingCosts.filter((cost) => !cost.isEstimated).map((cost) => cost.amount));
  if (exact > 0) return { shippingCost: exact, shippingSource: "exact" as const, estimatedShippingUsed: false };

  if (inputs.defaultShippingCost > 0) {
    return { shippingCost: inputs.defaultShippingCost, shippingSource: "rules" as const, estimatedShippingUsed: false };
  }

  return {
    shippingCost: Math.max(inputs.averageShippingCost30d, 0),
    shippingSource: "average" as const,
    estimatedShippingUsed: true
  };
}

function resolveFees(inputs: ProfitInputs) {
  const exactFees = sum(inputs.fees.map((fee) => fee.amount));
  if (exactFees > 0) {
    return { totalFees: exactFees, paymentFees: exactFees, shopifyFees: 0, missingFeeRule: false };
  }

  const paymentFees = inputs.revenue * (inputs.paymentFeePercent / 100);
  const shopifyFees = inputs.revenue * (inputs.shopifyFeePercent / 100);
  const totalFees = paymentFees + shopifyFees;

  return {
    totalFees,
    paymentFees,
    shopifyFees,
    missingFeeRule: inputs.paymentFeePercent <= 0 && inputs.shopifyFeePercent <= 0
  };
}

function resolveAdSpend(inputs: ProfitInputs) {
  const mode = (inputs.attributionMode ?? "none").toLowerCase();
  if (mode === "none") return { adSpendAllocation: 0, noAdDataWhenExpected: false };

  if (mode === "channel-weighted") {
    const channel = (inputs.attributionChannel ?? "").toLowerCase();
    const spendForChannel = sum(
      inputs.adEntriesForDay
        .filter((entry) => entry.channel.toLowerCase() === channel)
        .map((entry) => entry.amount)
    );

    if (spendForChannel > 0) {
      return { adSpendAllocation: inputs.attributionAdSpendAmount || spendForChannel, noAdDataWhenExpected: false };
    }

    return { adSpendAllocation: 0, noAdDataWhenExpected: true };
  }

  if (mode === "revenue-weighted") {
    const totalAdSpend = sum(inputs.adEntriesForDay.map((entry) => entry.amount));
    if (totalAdSpend <= 0 || inputs.totalStoreRevenueForDay <= 0) {
      return { adSpendAllocation: 0, noAdDataWhenExpected: true };
    }

    return {
      adSpendAllocation: (inputs.revenue / inputs.totalStoreRevenueForDay) * totalAdSpend,
      noAdDataWhenExpected: false
    };
  }

  return { adSpendAllocation: 0, noAdDataWhenExpected: false };
}

function resolveVariableCosts(inputs: ProfitInputs) {
  let perOrderCost = 0;
  let perItemCostByIndex = inputs.items.map(() => 0);

  for (const rule of inputs.variableCostRules) {
    if (!rule.isActive) continue;
    const type = rule.costType.toLowerCase();

    if (type.includes("per_order")) {
      perOrderCost += rule.amount;
      continue;
    }

    if (type.includes("per_item")) {
      perItemCostByIndex = perItemCostByIndex.map((value, index) => {
        const item = inputs.items[index];
        const matchesProduct = !rule.productId || rule.productId === item.productId;
        const matchesVariant = !rule.variantId || rule.variantId === item.variantId;
        if (!matchesProduct || !matchesVariant) return value;
        return value + rule.amount * item.quantity;
      });
    }
  }

  return { perOrderCost, perItemCostByIndex };
}

function computeConfidence(inputs: ConfidenceInputs) {
  let confidenceScore = 100;
  if (inputs.missingUnitCost) confidenceScore -= 25;
  if (inputs.estimatedShippingUsed) confidenceScore -= 10;
  if (inputs.noAdDataWhenExpected) confidenceScore -= 15;
  if (inputs.missingFeeRule) confidenceScore -= 10;
  if (inputs.incompleteRefundMapping) confidenceScore -= 10;
  return Math.max(0, Math.min(100, confidenceScore));
}

export function computeContributionProfit(inputs: ProfitInputs): ProfitComputation {
  const grossRevenues = inputs.items.map((item) => item.totalRevenue);

  const discountByItem = allocateDiscounts(inputs.discounts, grossRevenues);
  const refundByItem = allocateRefunds(inputs);

  const cogsByItem = inputs.items.map((item, index) => {
    const refundedQuantity = refundByItem[index].refundedQuantity;
    const fulfilledQuantity = Math.max(item.quantityFulfilled, 0);
    const fallbackUnitCost = item.unitPrice * (inputs.defaultCogsPercent / 100);
    const unitCost = item.cogsPerUnit > 0 ? item.cogsPerUnit : fallbackUnitCost;
    const effectiveFulfilledQty = Math.max(fulfilledQuantity - refundedQuantity, 0);
    return unitCost * effectiveFulfilledQty;
  });

  const shippingResolution = resolveShipping(inputs);
  const shippingByItem = allocateShipping(shippingResolution.shippingCost, grossRevenues);

  const feeResolution = resolveFees(inputs);
  const feesByItem = allocateFees(feeResolution.totalFees, grossRevenues);

  const adResolution = resolveAdSpend(inputs);
  const adsByItem = allocateAds(adResolution.adSpendAllocation, grossRevenues);

  const variableCostResolution = resolveVariableCosts(inputs);
  const perOrderVariableByItem = allocatePerOrderVariableCost(variableCostResolution.perOrderCost, grossRevenues);
  const variableByItem = perOrderVariableByItem.map((value, index) => value + variableCostResolution.perItemCostByIndex[index]);

  const allocations = buildNetItemAllocations({
    inputs,
    discountByItem,
    refundByItem,
    cogsByItem,
    shippingByItem,
    feesByItem,
    adsByItem,
    variableByItem
  });

  const cogs = sum(cogsByItem);
  const variableCostTotal = sum(variableByItem);
  const contributionProfit = sum(allocations.map((allocation) => allocation.netProfit));
  const totalCosts = inputs.revenue - contributionProfit;
  const margin = inputs.revenue > 0 ? contributionProfit / inputs.revenue : 0;

  const confidenceInputs: ConfidenceInputs = {
    missingUnitCost: inputs.items.some((item) => item.cogsPerUnit <= 0),
    estimatedShippingUsed: shippingResolution.estimatedShippingUsed,
    noAdDataWhenExpected: adResolution.noAdDataWhenExpected,
    missingFeeRule: feeResolution.missingFeeRule,
    incompleteRefundMapping:
      inputs.refunds > 0 &&
      inputs.refundRecords.some((refund) => refund.orderItemId == null || refund.refundedQuantity <= 0)
  };

  const confidenceScore = computeConfidence(confidenceInputs);

  return {
    allocations,
    shippingCost: shippingResolution.shippingCost,
    shippingSource: shippingResolution.shippingSource,
    paymentFees: feeResolution.paymentFees,
    shopifyFees: feeResolution.shopifyFees,
    adSpendAllocation: adResolution.adSpendAllocation,
    variableCostTotal,
    cogs,
    contributionProfit,
    margin,
    totalCosts,
    confidenceScore,
    confidenceInputs
  };
}
