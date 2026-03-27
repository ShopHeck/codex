import { prisma } from "@/lib/prisma";
import { recomputeOrderProfit, rebuildSnapshots } from "@/lib/services/profit";

type ShopifyOrderPayload = {
  id: number;
  name: string;
  created_at: string;
  financial_status: string;
  total_price: string;
  total_discounts: string;
  total_tax: string;
  line_items: Array<{
    id: number;
    product_id: number | null;
    variant_id: number | null;
    title: string;
    quantity: number;
    price: string;
    grams?: number;
  }>;
};

export async function upsertOrderFromWebhook(shop: string, payload: ShopifyOrderPayload) {
  const store = await prisma.shopifyStore.findUnique({ where: { shopDomain: shop } });
  if (!store) return;

  const order = await prisma.order.upsert({
    where: { shopifyOrderId: String(payload.id) },
    update: {
      orderNumber: payload.name,
      orderDate: new Date(payload.created_at),
      status: payload.financial_status,
      revenue: Number(payload.total_price),
      discounts: Number(payload.total_discounts),
      taxes: Number(payload.total_tax)
    },
    create: {
      storeId: store.id,
      shopifyOrderId: String(payload.id),
      orderNumber: payload.name,
      orderDate: new Date(payload.created_at),
      status: payload.financial_status,
      revenue: Number(payload.total_price),
      discounts: Number(payload.total_discounts),
      taxes: Number(payload.total_tax)
    }
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  for (const item of payload.line_items) {
    const unitPrice = Number(item.price);
    const cogsPerUnit = unitPrice * (store.defaultCogsPercent / 100);
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        shopifyLineItemId: String(item.id),
        productId: item.product_id ? String(item.product_id) : null,
        variantId: item.variant_id ? String(item.variant_id) : null,
        title: item.title,
        quantity: item.quantity,
        unitPrice,
        cogsPerUnit,
        totalRevenue: unitPrice * item.quantity,
        totalCogs: cogsPerUnit * item.quantity
      }
    });
  }

  await recomputeOrderProfit(order.id);
  await rebuildSnapshots(store.id);
}
