import { describe, expect, it } from "vitest";

import { computeContributionProfit } from "@/lib/services/profit/engine";
import type { ProfitInputs } from "@/lib/services/profit/types";

function baseInputs(overrides: Partial<ProfitInputs> = {}): ProfitInputs {
  return {
    revenue: 150,
    discounts: 30,
    refunds: 10,
    items: [
      {
        id: "item-1",
        quantity: 2,
        quantityFulfilled: 2,
        quantityRefunded: 0,
        unitPrice: 50,
        cogsPerUnit: 20,
        totalRevenue: 100,
        productId: "p1",
        variantId: "v1"
      },
      {
        id: "item-2",
        quantity: 1,
        quantityFulfilled: 1,
        quantityRefunded: 0,
        unitPrice: 50,
        cogsPerUnit: 10,
        totalRevenue: 50,
        productId: "p2",
        variantId: "v2"
      }
    ],
    refundRecords: [{ orderItemId: "item-1", amount: 10, shippingRefund: 0, taxRefund: 0, refundedQuantity: 1 }],
    shippingCosts: [{ amount: 12, isEstimated: false }],
    fees: [{ amount: 6 }],
    variableCostRules: [{ costType: "per_order", amount: 3, isActive: true }],
    adEntriesForDay: [{ channel: "facebook", amount: 30 }],
    totalStoreRevenueForDay: 300,
    defaultCogsPercent: 35,
    paymentFeePercent: 2.9,
    shopifyFeePercent: 2,
    defaultShippingCost: 6,
    averageShippingCost30d: 8,
    attributionMode: "revenue-weighted",
    attributionChannel: "facebook",
    attributionAdSpendAmount: 0,
    ...overrides
  };
}

describe("profit engine", () => {
  it("allocates discounts proportionally across line items", () => {
    const result = computeContributionProfit(baseInputs());
    expect(result.allocations[0].discountAllocated).toBeCloseTo(20);
    expect(result.allocations[1].discountAllocated).toBeCloseTo(10);
  });

  it("uses fulfilled quantity and refund quantity for cogs", () => {
    const result = computeContributionProfit(baseInputs());
    expect(result.allocations[0].cogsAllocated).toBeCloseTo(20);
    expect(result.allocations[1].cogsAllocated).toBeCloseTo(10);
  });

  it("applies shipping priority from exact to rules to average", () => {
    const exact = computeContributionProfit(baseInputs());
    expect(exact.shippingSource).toBe("exact");
    expect(exact.shippingCost).toBe(12);

    const rules = computeContributionProfit(baseInputs({ shippingCosts: [], defaultShippingCost: 9 }));
    expect(rules.shippingSource).toBe("rules");
    expect(rules.shippingCost).toBe(9);

    const average = computeContributionProfit(baseInputs({ shippingCosts: [], defaultShippingCost: 0, averageShippingCost30d: 7 }));
    expect(average.shippingSource).toBe("average");
    expect(average.shippingCost).toBe(7);
  });

  it("supports ad allocation modes none, revenue-weighted, channel-weighted", () => {
    const none = computeContributionProfit(baseInputs({ attributionMode: "none" }));
    expect(none.adSpendAllocation).toBe(0);

    const revenueWeighted = computeContributionProfit(baseInputs({ attributionMode: "revenue-weighted" }));
    expect(revenueWeighted.adSpendAllocation).toBeCloseTo(15);

    const channelWeighted = computeContributionProfit(
      baseInputs({ attributionMode: "channel-weighted", attributionAdSpendAmount: 11 })
    );
    expect(channelWeighted.adSpendAllocation).toBe(11);
  });

  it("supports variable costs per order and per item", () => {
    const result = computeContributionProfit(
      baseInputs({
        variableCostRules: [
          { costType: "per_order", amount: 3, isActive: true },
          { costType: "per_item", amount: 2, isActive: true, productId: "p1" }
        ]
      })
    );

    expect(result.variableCostTotal).toBeCloseTo(7);
    expect(result.allocations[0].variableCostAllocated).toBeGreaterThan(result.allocations[1].variableCostAllocated);
  });

  it("applies confidence penalties exactly from PROFIT_RULES", () => {
    const result = computeContributionProfit(
      baseInputs({
        items: [
          {
            id: "item-1",
            quantity: 1,
            quantityFulfilled: 1,
            quantityRefunded: 0,
            unitPrice: 100,
            cogsPerUnit: 0,
            totalRevenue: 100,
            productId: "p1",
            variantId: "v1"
          }
        ],
        shippingCosts: [],
        defaultShippingCost: 0,
        averageShippingCost30d: 10,
        attributionMode: "channel-weighted",
        adEntriesForDay: [],
        paymentFeePercent: 0,
        shopifyFeePercent: 0,
        refunds: 5,
        refundRecords: [{ orderItemId: null, amount: 5, shippingRefund: 0, taxRefund: 0, refundedQuantity: 0 }]
      })
    );

    expect(result.confidenceScore).toBe(30);
  });
});
