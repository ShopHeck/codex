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
  source_name?: string | null;
  referring_site?: string | null;
  landing_site?: string | null;
  current_subtotal_price?: string;
  current_total_discounts?: string;
  current_total_tax?: string;
  current_total_price?: string;
  shipping_lines?: Array<{
    price?: string;
    discounted_price?: string;
  }>;
  total_shipping_price_set?: {
    shop_money?: {
      amount?: string;
    };
  };
  total_outstanding?: string;
  refunds?: Array<{
    id?: number;
    created_at?: string;
    processed_at?: string;
    refund_line_items?: Array<{
      quantity?: number;
      line_item_id?: number;
      subtotal?: string;
      total_tax?: string;
      line_item?: {
        id?: number;
      };
    }>;
    transactions?: Array<{
      amount?: string;
    }>;
    order_adjustments?: Array<{
      amount?: string;
    }>;
    shipping?: {
      amount?: string;
      tax?: string;
    };
  }>;
  line_items: Array<{
    id: number;
    product_id: number | null;
    variant_id: number | null;
    title: string;
    quantity: number;
    fulfilled_quantity?: number;
    current_quantity?: number;
    fulfillable_quantity?: number;
    total_discount?: string;
    total_tax?: string;
    price: string;
    grams?: number;
  }>;
};

export async function upsertOrderFromWebhook(shop: string, payload: ShopifyOrderPayload) {
  const store = await prisma.shopifyStore.findUnique({ where: { shopDomain: shop } });
  if (!store) return;

  const shippingFromLines = (payload.shipping_lines ?? []).reduce((sum, line) => {
    const discounted = Number(line.discounted_price ?? Number.NaN);
    const base = Number(line.price ?? 0);
    return sum + (Number.isFinite(discounted) ? discounted : base);
  }, 0);
  const shippingTotal = Number(
    payload.total_shipping_price_set?.shop_money?.amount ??
      (shippingFromLines > 0 ? shippingFromLines : 0)
  );

  const refundedByLineItem = new Map<number, { quantity: number; amount: number; tax: number }>();
  let orderRefundsTotal = 0;

  for (const refund of payload.refunds ?? []) {
    let refundAmount = 0;
    for (const transaction of refund.transactions ?? []) {
      refundAmount += Number(transaction.amount ?? 0);
    }
    for (const adjustment of refund.order_adjustments ?? []) {
      refundAmount += Number(adjustment.amount ?? 0);
    }
    orderRefundsTotal += refundAmount;

    for (const refundLine of refund.refund_line_items ?? []) {
      const lineItemId = refundLine.line_item_id ?? refundLine.line_item?.id;
      if (!lineItemId) continue;

      const existing = refundedByLineItem.get(lineItemId) ?? { quantity: 0, amount: 0, tax: 0 };
      existing.quantity += Number(refundLine.quantity ?? 0);
      existing.amount += Number(refundLine.subtotal ?? 0);
      existing.tax += Number(refundLine.total_tax ?? 0);
      refundedByLineItem.set(lineItemId, existing);
    }
  }

  const order = await prisma.order.upsert({
    where: { shopifyOrderId: String(payload.id) },
    update: {
      orderNumber: payload.name,
      orderDate: new Date(payload.created_at),
      channel: payload.source_name ?? null,
      status: payload.financial_status,
      revenue: Number(payload.total_price),
      discounts: Number(payload.total_discounts),
      taxes: Number(payload.total_tax),
      refunds: orderRefundsTotal,
      shippingCost: Number.isFinite(shippingTotal) ? shippingTotal : 0
    },
    create: {
      storeId: store.id,
      shopifyOrderId: String(payload.id),
      orderNumber: payload.name,
      orderDate: new Date(payload.created_at),
      channel: payload.source_name ?? null,
      status: payload.financial_status,
      revenue: Number(payload.total_price),
      discounts: Number(payload.total_discounts),
      taxes: Number(payload.total_tax),
      refunds: orderRefundsTotal,
      shippingCost: Number.isFinite(shippingTotal) ? shippingTotal : 0
    }
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  for (const item of payload.line_items) {
    const unitPrice = Number(item.price);
    const cogsPerUnit = unitPrice * (store.defaultCogsPercent / 100);
    const refundedLine = refundedByLineItem.get(item.id);
    const quantityRefunded = refundedLine?.quantity ?? 0;
    const quantityFulfilled = item.fulfilled_quantity
      ?? (typeof item.fulfillable_quantity === "number" ? Math.max(0, item.quantity - item.fulfillable_quantity) : 0);
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        shopifyLineItemId: String(item.id),
        productId: item.product_id ? String(item.product_id) : null,
        variantId: item.variant_id ? String(item.variant_id) : null,
        title: item.title,
        quantity: item.quantity,
        quantityFulfilled,
        quantityRefunded,
        unitPrice,
        cogsPerUnit,
        totalRevenue: unitPrice * item.quantity,
        discountAllocated: Number(item.total_discount ?? 0),
        taxAllocated: Number(item.total_tax ?? 0),
        refundAllocated: refundedLine?.amount ?? 0,
        totalCogs: cogsPerUnit * item.quantity
      }
    });
  }

  await prisma.refund.deleteMany({ where: { orderId: order.id } });
  for (const refund of payload.refunds ?? []) {
    const refundedAt = new Date(refund.processed_at ?? refund.created_at ?? payload.created_at);
    let amount = 0;
    for (const transaction of refund.transactions ?? []) {
      amount += Number(transaction.amount ?? 0);
    }
    for (const adjustment of refund.order_adjustments ?? []) {
      amount += Number(adjustment.amount ?? 0);
    }

    const shippingRefund = Number(refund.shipping?.amount ?? 0);
    const taxRefund = Number(refund.shipping?.tax ?? 0);

    for (const refundLine of refund.refund_line_items ?? []) {
      const lineItemId = refundLine.line_item_id ?? refundLine.line_item?.id;
      const orderItem = lineItemId
        ? await prisma.orderItem.findFirst({
            where: { orderId: order.id, shopifyLineItemId: String(lineItemId) },
            select: { id: true, cogsPerUnit: true }
          })
        : null;
      const refundedQuantity = Number(refundLine.quantity ?? 0);

      await prisma.refund.create({
        data: {
          storeId: store.id,
          orderId: order.id,
          orderItemId: orderItem?.id ?? null,
          shopifyRefundId: refund.id ? String(refund.id) : null,
          refundedAt,
          amount: Number(refundLine.subtotal ?? amount),
          shippingRefund,
          taxRefund: Number(refundLine.total_tax ?? taxRefund),
          refundedQuantity,
          cogsReversalAmount: (orderItem?.cogsPerUnit ?? 0) * refundedQuantity
        }
      });
    }
  }

  await prisma.orderAttribution.upsert({
    where: { orderId: order.id },
    create: {
      storeId: store.id,
      orderId: order.id,
      mode: "webhook",
      sourceChannel: payload.source_name ?? payload.referring_site ?? null,
      campaign: payload.landing_site ?? null,
      adSpendAmount: 0,
      confidenceScore: 100
    },
    update: {
      sourceChannel: payload.source_name ?? payload.referring_site ?? null,
      campaign: payload.landing_site ?? null
    }
  });

  await recomputeOrderProfit(order.id);
  await rebuildSnapshots(store.id);
}
