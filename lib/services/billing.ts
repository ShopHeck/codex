import { BillingStatus } from "@prisma/client";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { shopifyGraphQL } from "@/lib/shopify/client";

const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST_MODE !== "false";

const CREATE_SUBSCRIPTION = `
mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!, $test: Boolean!) {
  appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
    confirmationUrl
    appSubscription { id status }
    userErrors { field message }
  }
}`;

const CHECK_SUBSCRIPTION_STATUS = `
query CheckSubscriptionStatus($id: ID!) {
  node(id: $id) {
    ... on AppSubscription {
      id
      status
    }
  }
}`;

export async function ensureBilling(storeId: string, manage = false) {
  const store = await prisma.shopifyStore.findUnique({
    where: { id: storeId }
  });
  if (!store) throw new Error("Store not found");

  const activeSubscription = await prisma.billingSubscription.findFirst({
    where: { storeId: store.id, status: BillingStatus.ACTIVE },
    orderBy: { createdAt: "desc" }
  });

  if (activeSubscription && !manage) return { active: true };

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
    test: BILLING_TEST_MODE,
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

export async function confirmBillingSubscription(storeId: string, chargeId: string | null) {
  const store = await prisma.shopifyStore.findUnique({
    where: { id: storeId }
  });

  if (!store) throw new Error("Store not found");

  const pendingSubscription = await prisma.billingSubscription.findFirst({
    where: { storeId, status: BillingStatus.PENDING },
    orderBy: { createdAt: "desc" }
  });

  if (!pendingSubscription) {
    return { result: "no_pending" as const };
  }

  if (!chargeId) {
    await prisma.billingSubscription.update({
      where: { id: pendingSubscription.id },
      data: { status: BillingStatus.CANCELLED }
    });

    return { result: "abandoned" as const };
  }

  const response = await shopifyGraphQL<{
    node: { id: string; status: string } | null;
  }>(store.shopDomain, store.accessToken, CHECK_SUBSCRIPTION_STATUS, {
    id: pendingSubscription.shopifySubscriptionGid
  });

  const remoteStatus = response.node?.status ?? "UNKNOWN";
  const isActive = remoteStatus === "ACTIVE" || remoteStatus === "ACCEPTED";
  const nextStatus = isActive ? BillingStatus.ACTIVE : BillingStatus.CANCELLED;

  await prisma.billingSubscription.update({
    where: { id: pendingSubscription.id },
    data: { status: nextStatus }
  });

  return {
    result: isActive ? ("active" as const) : ("declined" as const),
    remoteStatus
  };
}
