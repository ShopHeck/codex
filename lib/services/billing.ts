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

export async function activateLatestPendingBilling(storeId: string) {
  await prisma.billingSubscription.updateMany({
    where: { storeId, status: BillingStatus.PENDING },
    data: { status: BillingStatus.ACTIVE }
  });
}
