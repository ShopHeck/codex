import { prisma } from "@/lib/prisma";
import { ManualAdsService } from "@/lib/services/ads-service";

const adsService = new ManualAdsService();

export async function recomputeOrderProfit(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, store: true }
  });
  if (!order) return;

  const cogs = (order.items as Array<{ totalCogs: number }>).reduce((sum: number, item: { totalCogs: number }) => sum + item.totalCogs, 0);
  const paymentFees = order.revenue * (order.store.paymentFeePercent / 100);
  const shopifyFees = order.revenue * (order.store.shopifyFeePercent / 100);
  const shippingCost = order.shippingCost || order.store.defaultShippingCost;
  const adSpendAllocation = await adsService.getDailySpend(order.storeId, order.orderDate);

  const monthlyExpenses = await prisma.expense.aggregate({
    where: { storeId: order.storeId, recurring: true },
    _sum: { amount: true }
  });
  const appCostAllocation = (monthlyExpenses._sum.amount ?? 0) / 30;

  const totalCosts =
    cogs +
    paymentFees +
    shopifyFees +
    shippingCost +
    adSpendAllocation +
    appCostAllocation +
    order.refunds +
    order.otherCosts;
  const netProfit = order.revenue - totalCosts;
  const margin = order.revenue > 0 ? netProfit / order.revenue : 0;

  await prisma.order.update({
    where: { id: orderId },
    data: { cogs, paymentFees, shopifyFees, shippingCost, adSpendAllocation, appCostAllocation, totalCosts, netProfit, margin }
  });
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
      update: { revenue: values.revenue, totalCosts: values.totalCosts, netProfit: values.netProfit, margin },
      create: {
        storeId,
        date: new Date(date),
        revenue: values.revenue,
        totalCosts: values.totalCosts,
        netProfit: values.netProfit,
        margin
      }
    });
  }
}
