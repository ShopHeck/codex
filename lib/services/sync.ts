import { prisma } from "@/lib/prisma";
import { recomputeOrderProfit, rebuildSnapshots } from "@/lib/services/profit";

type ShopifyOrderPayload = {
  id: number;
  name: string;
  created_at: string;
  financial_status: string;
  fulfillment_status?: string | null;
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
    product_id: number | string | null;
    variant_id: number | string | null;
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

const toNumber = (value: string | number | undefined | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function upsertOrderFromWebhook(shop: string, payload: ShopifyOrderPayload) {
  const store = await prisma.shopifyStore.findUnique({ where: { shopDomain: shop } });
  if (!store) return;
  const hasOrderChannelUpdate = Object.prototype.hasOwnProperty.call(payload, "source_name")
    || Object.prototype.hasOwnProperty.call(payload, "referring_site");

  const shippingFromLines = (payload.shipping_lines ?? []).reduce((sum, line) => {
    const discounted = Number(line.discounted_price ?? Number.NaN);
    const base = toNumber(line.price);
    return sum + (Number.isFinite(discounted) ? discounted : base);
  }, 0);
  const shippingTotal = toNumber(
    payload.total_shipping_price_set?.shop_money?.amount ??
      (shippingFromLines > 0 ? shippingFromLines : 0)
  );

  const refundedByLineItem = new Map<number, { quantity: number; amount: number; tax: number }>();
  let orderRefundsTotal = 0;

  for (const refund of payload.refunds ?? []) {
    let transactionAndAdjustmentTotal = 0;
    for (const transaction of refund.transactions ?? []) {
      transactionAndAdjustmentTotal += toNumber(transaction.amount);
    }
    for (const adjustment of refund.order_adjustments ?? []) {
      transactionAndAdjustmentTotal += toNumber(adjustment.amount);
    }

    const lineItemSubtotalTotal = (refund.refund_line_items ?? []).reduce((sum, refundLine) => {
      return sum + toNumber(refundLine.subtotal) + toNumber(refundLine.total_tax);
    }, 0);
    const shippingAndTaxRefundTotal = toNumber(refund.shipping?.amount) + toNumber(refund.shipping?.tax);
    const rawRefundTotal = transactionAndAdjustmentTotal > 0
      ? transactionAndAdjustmentTotal
      : lineItemSubtotalTotal + shippingAndTaxRefundTotal;
    orderRefundsTotal += rawRefundTotal;

    for (const refundLine of refund.refund_line_items ?? []) {
      const lineItemId = refundLine.line_item_id ?? refundLine.line_item?.id;
      if (!lineItemId) continue;

      const existing = refundedByLineItem.get(lineItemId) ?? { quantity: 0, amount: 0, tax: 0 };
      existing.quantity += toNumber(refundLine.quantity);
      existing.amount += toNumber(refundLine.subtotal);
      existing.tax += toNumber(refundLine.total_tax);
      refundedByLineItem.set(lineItemId, existing);
    }
  }

  const order = await prisma.order.upsert({
    where: { shopifyOrderId: String(payload.id) },
    update: {
      orderNumber: payload.name,
      orderDate: new Date(payload.created_at),
      ...(hasOrderChannelUpdate ? { channel: payload.source_name ?? payload.referring_site ?? null } : {}),
      status: payload.financial_status,
      revenue: toNumber(payload.current_total_price ?? payload.total_price),
      discounts: toNumber(payload.current_total_discounts ?? payload.total_discounts),
      taxes: toNumber(payload.current_total_tax ?? payload.total_tax),
      refunds: orderRefundsTotal,
      shippingCost: Number.isFinite(shippingTotal) ? shippingTotal : 0
    },
    create: {
      storeId: store.id,
      shopifyOrderId: String(payload.id),
      orderNumber: payload.name,
      orderDate: new Date(payload.created_at),
      channel: payload.source_name ?? payload.referring_site ?? null,
      status: payload.financial_status,
      revenue: toNumber(payload.current_total_price ?? payload.total_price),
      discounts: toNumber(payload.current_total_discounts ?? payload.total_discounts),
      taxes: toNumber(payload.current_total_tax ?? payload.total_tax),
      refunds: orderRefundsTotal,
      shippingCost: Number.isFinite(shippingTotal) ? shippingTotal : 0
    }
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  for (const item of payload.line_items) {
    const unitPrice = toNumber(item.price);
    const cogsPerUnit = unitPrice * (store.defaultCogsPercent / 100);
    const refundedLine = refundedByLineItem.get(item.id);
    const quantityRefundedFromCurrent = typeof item.current_quantity === "number"
      ? Math.max(0, item.quantity - item.current_quantity)
      : 0;
    const quantityRefunded = Math.max(refundedLine?.quantity ?? 0, quantityRefundedFromCurrent);
    const quantityFulfilled = item.fulfilled_quantity
      ?? (typeof item.fulfillable_quantity === "number"
        ? Math.max(0, item.quantity - item.fulfillable_quantity)
        : payload.fulfillment_status === "fulfilled"
          ? item.quantity
          : 0);
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        shopifyLineItemId: String(item.id),
        productId: item.product_id != null ? String(item.product_id) : null,
        variantId: item.variant_id != null ? String(item.variant_id) : null,
        title: item.title,
        quantity: item.quantity,
        quantityFulfilled,
        quantityRefunded,
        unitPrice,
        cogsPerUnit,
        totalRevenue: unitPrice * item.quantity,
        discountAllocated: 0,
        taxAllocated: toNumber(item.total_tax),
        refundAllocated: 0,
        totalCogs: cogsPerUnit * item.quantity
      }
    });
  }

  await prisma.refund.deleteMany({ where: { orderId: order.id } });
  for (const refund of payload.refunds ?? []) {
    const refundedAt = new Date(refund.processed_at ?? refund.created_at ?? payload.created_at);
    let amount = 0;
    for (const transaction of refund.transactions ?? []) {
      amount += toNumber(transaction.amount);
    }
    for (const adjustment of refund.order_adjustments ?? []) {
      amount += toNumber(adjustment.amount);
    }

    const shippingRefund = toNumber(refund.shipping?.amount);
    const taxRefund = toNumber(refund.shipping?.tax);
    const refundLines = refund.refund_line_items ?? [];
    const totalRefundFromLines = refundLines.reduce((sum, refundLine) => {
      return sum + toNumber(refundLine.subtotal) + toNumber(refundLine.total_tax);
    }, 0) + shippingRefund + taxRefund;
    const refundAmount = amount > 0 ? amount : totalRefundFromLines;
    const mappedSubtotal = refundLines.reduce((sum, refundLine) => {
      if (refundLine.subtotal == null) return sum;
      return sum + toNumber(refundLine.subtotal);
    }, 0);
    const missingSubtotalCount = refundLines.reduce((count, refundLine) => {
      return count + (refundLine.subtotal == null ? 1 : 0);
    }, 0);
    const remainingUnmappedAmount = Math.max(0, refundAmount - mappedSubtotal);
    const fallbackSubtotalPerMissingLine = missingSubtotalCount > 0
      ? remainingUnmappedAmount / missingSubtotalCount
      : 0;

    for (const refundLine of refundLines) {
      const lineItemId = refundLine.line_item_id ?? refundLine.line_item?.id;
      const orderItem = lineItemId
        ? await prisma.orderItem.findFirst({
            where: { orderId: order.id, shopifyLineItemId: String(lineItemId) },
            select: { id: true, cogsPerUnit: true }
          })
        : null;
      const refundedQuantity = toNumber(refundLine.quantity);

      await prisma.refund.create({
        data: {
          storeId: store.id,
          orderId: order.id,
          orderItemId: orderItem?.id ?? null,
          shopifyRefundId: refund.id ? String(refund.id) : null,
          refundedAt,
          amount: toNumber(refundLine.subtotal ?? fallbackSubtotalPerMissingLine),
          shippingRefund,
          taxRefund: toNumber(refundLine.total_tax ?? taxRefund),
          refundedQuantity,
          cogsReversalAmount: (orderItem?.cogsPerUnit ?? 0) * refundedQuantity
        }
      });
    }

    if (refundLines.length === 0) {
      await prisma.refund.create({
        data: {
          storeId: store.id,
          orderId: order.id,
          orderItemId: null,
          shopifyRefundId: refund.id ? String(refund.id) : null,
          refundedAt,
          amount: refundAmount,
          shippingRefund,
          taxRefund,
          refundedQuantity: 0,
          cogsReversalAmount: 0
        }
      });
    }
  }

  const hasSourceUpdate = Object.prototype.hasOwnProperty.call(payload, "source_name")
    || Object.prototype.hasOwnProperty.call(payload, "referring_site");
  const hasCampaignUpdate = Object.prototype.hasOwnProperty.call(payload, "landing_site");
  const sourceChannel = payload.source_name ?? payload.referring_site ?? null;
  const campaign = payload.landing_site ?? null;

  await prisma.orderAttribution.upsert({
    where: { orderId: order.id },
    create: {
      storeId: store.id,
      orderId: order.id,
      mode: "webhook",
      sourceChannel,
      campaign,
      adSpendAmount: 0,
      confidenceScore: 100
    },
    update: {
      ...(hasSourceUpdate ? { sourceChannel } : {}),
      ...(hasCampaignUpdate ? { campaign } : {})
    }
  });

  await recomputeOrderProfit(order.id);
  await rebuildSnapshots(store.id);
}
