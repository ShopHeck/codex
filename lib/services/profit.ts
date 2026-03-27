import { prisma } from "@/lib/prisma";
import { computeContributionProfit } from "@/lib/services/profit/engine";

export async function recomputeOrderProfit(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      store: true,
      fees: true,
      shippingCosts: true,
      refundRecords: true,
      attribution: true
    }
  });
  if (!order) return;

  const [variableCostRules, adEntriesForDay, averageShippingAgg, dayOrders] = await Promise.all([
    prisma.variableCostRule.findMany({ where: { storeId: order.storeId, isActive: true } }),
    prisma.adSpendEntry.findMany({
      where: {
        storeId: order.storeId,
        date: {
          gte: new Date(order.orderDate.toISOString().slice(0, 10)),
          lt: new Date(new Date(order.orderDate.toISOString().slice(0, 10)).getTime() + 24 * 60 * 60 * 1000)
        }
      }
    }),
    prisma.shippingCost.aggregate({
      where: {
        storeId: order.storeId,
        createdAt: { gte: new Date(order.orderDate.getTime() - 30 * 24 * 60 * 60 * 1000) }
      },
      _avg: { amount: true }
    }),
    prisma.order.findMany({
      where: {
        storeId: order.storeId,
        orderDate: {
          gte: new Date(order.orderDate.toISOString().slice(0, 10)),
          lt: new Date(new Date(order.orderDate.toISOString().slice(0, 10)).getTime() + 24 * 60 * 60 * 1000)
        }
      },
      select: { revenue: true }
    })
  ]);

  const computation = computeContributionProfit({
    revenue: order.revenue,
    discounts: order.discounts,
    refunds: order.refunds,
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      quantityFulfilled: item.quantityFulfilled,
      quantityRefunded: item.quantityRefunded,
      unitPrice: item.unitPrice,
      cogsPerUnit: item.cogsPerUnit,
      totalRevenue: item.totalRevenue,
      productId: item.productId,
      variantId: item.variantId
    })),
    refundRecords: order.refundRecords.map((refund) => ({
      orderItemId: refund.orderItemId,
      amount: refund.amount,
      shippingRefund: refund.shippingRefund,
      taxRefund: refund.taxRefund,
      refundedQuantity: refund.refundedQuantity
    })),
    shippingCosts: order.shippingCosts.map((shippingCost) => ({
      amount: shippingCost.amount,
      isEstimated: shippingCost.isEstimated
    })),
    fees: order.fees.map((fee) => ({ amount: fee.amount })),
    variableCostRules,
    adEntriesForDay: adEntriesForDay.map((entry) => ({ amount: entry.amount, channel: entry.channel })),
    totalStoreRevenueForDay: dayOrders.reduce((acc, dayOrder) => acc + dayOrder.revenue, 0),
    defaultCogsPercent: order.store.defaultCogsPercent,
    paymentFeePercent: order.store.paymentFeePercent,
    shopifyFeePercent: order.store.shopifyFeePercent,
    defaultShippingCost: order.store.defaultShippingCost,
    averageShippingCost30d: averageShippingAgg._avg.amount ?? 0,
    attributionMode: order.attribution?.mode ?? null,
    attributionChannel: order.attribution?.sourceChannel ?? null,
    attributionAdSpendAmount: order.attribution?.adSpendAmount ?? 0
  });

  await prisma.$transaction([
    ...computation.allocations.map((allocation) =>
      prisma.orderItem.update({
        where: { id: allocation.itemId },
        data: {
          discountAllocated: allocation.discountAllocated,
          refundAllocated: allocation.refundAllocated,
          cogsAllocated: allocation.cogsAllocated,
          shippingAllocated: allocation.shippingAllocated,
          feeAllocated: allocation.feeAllocated,
          adSpendAllocated: allocation.adSpendAllocated,
          variableCostAllocated: allocation.variableCostAllocated,
          netProfit: allocation.netProfit,
          marginPercent: allocation.marginPercent
        }
      })
    ),
    prisma.order.update({
      where: { id: order.id },
      data: {
        cogs: computation.cogs,
        paymentFees: computation.paymentFees,
        shopifyFees: computation.shopifyFees,
        shippingCost: computation.shippingCost,
        adSpendAllocation: computation.adSpendAllocation,
        appCostAllocation: computation.variableCostTotal,
        totalCosts: computation.totalCosts,
        netProfit: computation.contributionProfit,
        margin: computation.margin,
        otherCosts: 0
      }
    }),
    prisma.orderAttribution.upsert({
      where: { orderId: order.id },
      create: {
        storeId: order.storeId,
        orderId: order.id,
        mode: order.attribution?.mode ?? "none",
        sourceChannel: order.attribution?.sourceChannel,
        campaign: JSON.stringify(computation.confidenceInputs),
        adSpendAmount: computation.adSpendAllocation,
        confidenceScore: computation.confidenceScore
      },
      update: {
        campaign: JSON.stringify(computation.confidenceInputs),
        adSpendAmount: computation.adSpendAllocation,
        confidenceScore: computation.confidenceScore
      }
    })
  ]);
}

export async function rebuildSnapshots(storeId: string) {
  const orders = await prisma.order.findMany({ where: { storeId } });
  const byDate = new Map<string, { revenue: number; totalCosts: number; netProfit: number }>();

  for (const order of orders) {
    const date = order.orderDate.toISOString().slice(0, 10);
    const entry = byDate.get(date) ?? { revenue: 0, totalCosts: 0, netProfit: 0 };
    entry.revenue += order.revenue;
    entry.totalCosts += order.totalCosts;
    entry.netProfit += order.netProfit;
    byDate.set(date, entry);
  }

  for (const [date, values] of byDate.entries()) {
    const margin = values.revenue > 0 ? values.netProfit / values.revenue : 0;
    await prisma.dailyProfitSnapshot.upsert({
      where: { storeId_date: { storeId, date: new Date(date) } },
      update: {
        revenue: values.revenue,
        totalCosts: values.totalCosts,
        contributionProfit: values.netProfit,
        netProfit: values.netProfit,
        margin
      },
      create: {
        storeId,
        date: new Date(date),
        revenue: values.revenue,
        totalCosts: values.totalCosts,
        contributionProfit: values.netProfit,
        netProfit: values.netProfit,
        margin
      }
    });
  }
}
