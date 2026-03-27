import { BillingStatus } from "@prisma/client";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { shopifyGraphQL } from "@/lib/shopify/client";

const CREATE_SUBSCRIPTION = `
mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!) {
  appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: true) {
    confirmationUrl
    appSubscription { id status }
    userErrors { field message }
  }
}`;

const GET_SUBSCRIPTION_STATUS = `
query GetSubscriptionStatus($id: ID!) {
  node(id: $id) {
    ... on AppSubscription {
      id
      status
      currentPeriodEnd
    }
  }
}`;

type ShopifySubscriptionStatus = {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
};

function isActiveShopifyStatus(status: string) {
  return status === "ACTIVE" || status === "ACCEPTED";
}

function isCancelledShopifyStatus(status: string) {
  return ["CANCELLED", "DECLINED", "EXPIRED", "FROZEN"].includes(status);
}

export async function getSubscriptionStatusByGid(
  shopDomain: string,
  accessToken: string,
  shopifySubscriptionGid: string
): Promise<ShopifySubscriptionStatus | null> {
  const data = await shopifyGraphQL<{
    node: ShopifySubscriptionStatus | null;
  }>(shopDomain, accessToken, GET_SUBSCRIPTION_STATUS, { id: shopifySubscriptionGid });

  return data.node;
}

export async function ensureBilling(storeId: string, manage = false) {
  const store = await prisma.shopifyStore.findUnique({
    where: { id: storeId },
    include: { billingSubscriptions: { orderBy: { createdAt: "desc" }, take: 1 } }
  });
  if (!store) throw new Error("Store not found");

  const active = store.billingSubscriptions.find((subscription: { status: BillingStatus }) => subscription.status === BillingStatus.ACTIVE);
  if (active && !manage) return { active: true };

  const plan = await prisma.billingPlan.upsert({
    where: { key: "starter" },
    update: {},
    create: { key: "starter", name: "Starter", monthlyPrice: 29, shopifyPlanName: "Starter" }
  });

  const returnUrl = `${config.appUrl}/api/billing/confirm?shop=${store.shopDomain}&storeId=${store.id}`;

  const data = await shopifyGraphQL<{
    appSubscriptionCreate: {
      confirmationUrl: string;
      appSubscription: { id: string; status: string };
      userErrors: Array<{ message: string }>;
    };
  }>(store.shopDomain, store.accessToken, CREATE_SUBSCRIPTION, {
    name: config.billing.starter.name,
    returnUrl,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: config.billing.starter.lineItem.amount,
              currencyCode: config.billing.starter.lineItem.currencyCode
            },
            interval: config.billing.starter.lineItem.interval
          }
        }
      }
    ]
  });

  if (data.appSubscriptionCreate.userErrors.length) {
    throw new Error(data.appSubscriptionCreate.userErrors[0].message);
  }

  await prisma.billingSubscription.create({
    data: {
      storeId: store.id,
      planId: plan.id,
      shopifySubscriptionGid: data.appSubscriptionCreate.appSubscription.id,
      status: BillingStatus.PENDING,
      confirmationUrl: data.appSubscriptionCreate.confirmationUrl
    }
  });

  return { active: false, confirmationUrl: data.appSubscriptionCreate.confirmationUrl };
}

function buildShopifySubscriptionGidCandidates(chargeId: string) {
  const trimmedChargeId = chargeId.trim();
  if (!trimmedChargeId) return [];

  const candidates = new Set<string>([trimmedChargeId]);
  if (!trimmedChargeId.startsWith("gid://")) {
    candidates.add(`gid://shopify/AppSubscription/${trimmedChargeId}`);
  }

  return Array.from(candidates);
}

export async function confirmLatestPendingBilling(storeId: string, chargeId: string) {
  const store = await prisma.shopifyStore.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Store not found");

  const normalizedChargeId = chargeId.trim();
  const gidCandidates = buildShopifySubscriptionGidCandidates(normalizedChargeId);
  const pending = await prisma.billingSubscription.findFirst({
    where: {
      storeId,
      status: BillingStatus.PENDING,
      OR: [
        { shopifySubscriptionGid: { in: gidCandidates } },
        { shopifySubscriptionGid: { endsWith: `/${normalizedChargeId}` } }
      ]
    },
    orderBy: { createdAt: "desc" }
  });

  if (!pending) {
    const matchedHistorical = await prisma.billingSubscription.findFirst({
      where: {
        storeId,
        OR: [
          { shopifySubscriptionGid: { in: gidCandidates } },
          { shopifySubscriptionGid: { endsWith: `/${normalizedChargeId}` } }
        ]
      },
      orderBy: { createdAt: "desc" }
    });

    if (matchedHistorical) {
      return {
        outcome: "already_processed" as const,
        status: matchedHistorical.status,
        transitionedAt: matchedHistorical.updatedAt
      };
    }

    const latest = await prisma.billingSubscription.findFirst({
      where: { storeId },
      orderBy: { createdAt: "desc" }
    });

    return {
      outcome: "already_processed" as const,
      status: latest?.status ?? null,
      transitionedAt: latest?.updatedAt ?? null
    };
  }

  if (!pending.shopifySubscriptionGid) {
    await prisma.billingSubscription.updateMany({
      where: { id: pending.id, status: BillingStatus.PENDING },
      data: { status: BillingStatus.CANCELLED }
    });

    const updated = await prisma.billingSubscription.findUnique({ where: { id: pending.id } });
    return {
      outcome: "invalid" as const,
      status: BillingStatus.CANCELLED,
      shopifyStatus: null,
      transitionedAt: updated?.updatedAt ?? null
    };
  }

  const shopifySubscription = await getSubscriptionStatusByGid(
    store.shopDomain,
    store.accessToken,
    pending.shopifySubscriptionGid
  );

  if (!shopifySubscription) {
    await prisma.billingSubscription.updateMany({
      where: { id: pending.id, status: BillingStatus.PENDING },
      data: { status: BillingStatus.CANCELLED }
    });

    const updated = await prisma.billingSubscription.findUnique({ where: { id: pending.id } });
    return {
      outcome: "invalid" as const,
      status: BillingStatus.CANCELLED,
      shopifyStatus: null,
      transitionedAt: updated?.updatedAt ?? null
    };
  }

  if (isActiveShopifyStatus(shopifySubscription.status)) {
    await prisma.billingSubscription.updateMany({
      where: { id: pending.id, status: BillingStatus.PENDING },
      data: {
        status: BillingStatus.ACTIVE,
        currentPeriodEnd: shopifySubscription.currentPeriodEnd ? new Date(shopifySubscription.currentPeriodEnd) : null
      }
    });

    const updated = await prisma.billingSubscription.findUnique({ where: { id: pending.id } });
    return {
      outcome: "activated" as const,
      status: BillingStatus.ACTIVE,
      shopifyStatus: shopifySubscription.status,
      transitionedAt: updated?.updatedAt ?? null
    };
  }

  if (isCancelledShopifyStatus(shopifySubscription.status)) {
    await prisma.billingSubscription.updateMany({
      where: { id: pending.id, status: BillingStatus.PENDING },
      data: { status: BillingStatus.CANCELLED }
    });

    const updated = await prisma.billingSubscription.findUnique({ where: { id: pending.id } });
    return {
      outcome: "cancelled" as const,
      status: BillingStatus.CANCELLED,
      shopifyStatus: shopifySubscription.status,
      transitionedAt: updated?.updatedAt ?? null
    };
  }

  return {
    outcome: "pending" as const,
    status: BillingStatus.PENDING,
    shopifyStatus: shopifySubscription.status,
    transitionedAt: pending.updatedAt
  };
}
