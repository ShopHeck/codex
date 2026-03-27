import { BillingStatus, ExpenseType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { email: "demo@realprofit.app" },
    update: {},
    create: { email: "demo@realprofit.app", name: "Demo Merchant" }
  });

  const store = await prisma.shopifyStore.upsert({
    where: { shopDomain: "demo-store.myshopify.com" },
    update: {},
    create: {
      merchantId: merchant.id,
      shopDomain: "demo-store.myshopify.com",
      accessToken: "demo-token",
      shopName: "Demo Store",
      onboardingCompleted: true
    }
  });

  const plan = await prisma.billingPlan.upsert({
    where: { key: "starter" },
    update: {},
    create: { key: "starter", name: "Starter", monthlyPrice: 29, shopifyPlanName: "Starter" }
  });

  await prisma.billingSubscription.create({
    data: {
      storeId: store.id,
      planId: plan.id,
      status: BillingStatus.ACTIVE,
      shopifySubscriptionGid: "gid://shopify/AppSubscription/demo"
    }
  });

  await prisma.expense.create({
    data: { storeId: store.id, date: new Date(), label: "Klaviyo", type: ExpenseType.SAAS, amount: 120, recurring: true }
  });

  await prisma.adSpendEntry.create({
    data: { storeId: store.id, date: new Date(), channel: "meta", amount: 240 }
  });

  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());
