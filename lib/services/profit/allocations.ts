import type { LineItemAllocation, ProfitInputs } from "@/lib/services/profit/types";

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

export function allocateProportionally(total: number, weights: number[]) {
  const totalWeight = sum(weights);
  if (totalWeight <= 0) return weights.map(() => 0);
  return weights.map((weight) => (weight / totalWeight) * total);
}

export function allocateDiscounts(totalDiscount: number, grossRevenues: number[]) {
  return allocateProportionally(totalDiscount, grossRevenues);
}

export function allocateRefunds(inputs: ProfitInputs) {
  const perItemAmount = new Map<string, number>();
  const perItemQty = new Map<string, number>();
  let unassignedAmount = 0;
  let mappedTotal = 0;

  for (const refund of inputs.refundRecords) {
    mappedTotal += refund.amount;

    if (refund.orderItemId) {
      perItemAmount.set(refund.orderItemId, (perItemAmount.get(refund.orderItemId) ?? 0) + refund.amount);
      perItemQty.set(refund.orderItemId, (perItemQty.get(refund.orderItemId) ?? 0) + refund.refundedQuantity);
    } else {
      unassignedAmount += refund.amount;
    }
  }

  const fallbackUnmappedRefund = Math.max(inputs.refunds - mappedTotal, 0);
  const totalUnassignedRefund = unassignedAmount + fallbackUnmappedRefund;

  const revenueWeights = inputs.items.map((item) => item.totalRevenue);
  const unassignedDistribution = allocateProportionally(totalUnassignedRefund, revenueWeights);

  return inputs.items.map((item, index) => ({
    refundAllocated: (perItemAmount.get(item.id) ?? 0) + unassignedDistribution[index],
    refundedQuantity: Math.max(item.quantityRefunded, perItemQty.get(item.id) ?? 0)
  }));
}

export function allocateFees(totalFees: number, grossRevenues: number[]) {
  return allocateProportionally(totalFees, grossRevenues);
}

export function allocateShipping(shippingCost: number, grossRevenues: number[]) {
  return allocateProportionally(shippingCost, grossRevenues);
}

export function allocateAds(adSpendAllocation: number, grossRevenues: number[]) {
  return allocateProportionally(adSpendAllocation, grossRevenues);
}

export function allocatePerOrderVariableCost(totalPerOrderCost: number, grossRevenues: number[]) {
  return allocateProportionally(totalPerOrderCost, grossRevenues);
}

export function buildNetItemAllocations(params: {
  inputs: ProfitInputs;
  discountByItem: number[];
  refundByItem: { refundAllocated: number; refundedQuantity: number }[];
  cogsByItem: number[];
  shippingByItem: number[];
  feesByItem: number[];
  adsByItem: number[];
  variableByItem: number[];
}): LineItemAllocation[] {
  const { inputs, discountByItem, refundByItem, cogsByItem, shippingByItem, feesByItem, adsByItem, variableByItem } = params;

  return inputs.items.map((item, index) => {
    const netProfit =
      item.totalRevenue -
      discountByItem[index] -
      refundByItem[index].refundAllocated -
      cogsByItem[index] -
      shippingByItem[index] -
      feesByItem[index] -
      adsByItem[index] -
      variableByItem[index];

    return {
      itemId: item.id,
      grossRevenue: item.totalRevenue,
      discountAllocated: discountByItem[index],
      refundAllocated: refundByItem[index].refundAllocated,
      cogsAllocated: cogsByItem[index],
      shippingAllocated: shippingByItem[index],
      feeAllocated: feesByItem[index],
      adSpendAllocated: adsByItem[index],
      variableCostAllocated: variableByItem[index],
      netProfit,
      marginPercent: item.totalRevenue > 0 ? netProfit / item.totalRevenue : 0
    };
  });
}
