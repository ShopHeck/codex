import { BillingStatus, ExpenseType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIXTURE = {
  merchant: {
    email: "demo@realprofit.app",
    name: "Demo Merchant"
  },
  store: {
    shopDomain: "demo-store.myshopify.com",
    accessToken: "demo-token",
    shopName: "Demo Store",
    currency: "USD",
    timezone: "UTC",
    onboardingCompleted: true,
    defaultCogsPercent: 35,
    paymentFeePercent: 2.9,
    shopifyFeePercent: 2,
    defaultShippingCost: 6
  },
  billingPlan: {
    key: "starter",
    name: "Starter",
    monthlyPrice: 29,
    shopifyPlanName: "Starter"
  },
  subscription: {
    shopifySubscriptionGid: "gid://shopify/AppSubscription/demo-starter",
    status: BillingStatus.ACTIVE,
    confirmationUrl: "https://admin.shopify.com/store/demo-store/charges/confirm",
    currentPeriodEnd: new Date("2026-12-31T00:00:00.000Z")
  },
  recurringExpenses: [
    {
      date: new Date("2026-01-01T00:00:00.000Z"),
      label: "Klaviyo",
      type: ExpenseType.SAAS,
      amount: 120,
      recurring: true
    }
  ],
  adSpendEntries: [
    {
      date: new Date("2026-01-01T00:00:00.000Z"),
      channel: "meta",
      amount: 240,
      notes: "Deterministic fixture: Meta spend"
    },
    {
      date: new Date("2026-01-01T00:00:00.000Z"),
      channel: "google",
      amount: 160,
      notes: "Deterministic fixture: Google spend"
    }
  ]
} as const;

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { email: FIXTURE.merchant.email },
    update: { name: FIXTURE.merchant.name },
    create: FIXTURE.merchant
  });

  const store = await prisma.shopifyStore.upsert({
    where: { shopDomain: FIXTURE.store.shopDomain },
    update: {
      merchantId: merchant.id,
      accessToken: FIXTURE.store.accessToken,
      shopName: FIXTURE.store.shopName,
      currency: FIXTURE.store.currency,
      timezone: FIXTURE.store.timezone,
      onboardingCompleted: FIXTURE.store.onboardingCompleted,
      defaultCogsPercent: FIXTURE.store.defaultCogsPercent,
      paymentFeePercent: FIXTURE.store.paymentFeePercent,
      shopifyFeePercent: FIXTURE.store.shopifyFeePercent,
      defaultShippingCost: FIXTURE.store.defaultShippingCost
    },
    create: {
      merchantId: merchant.id,
      ...FIXTURE.store
    }
  });

  const plan = await prisma.billingPlan.upsert({
    where: { key: FIXTURE.billingPlan.key },
    update: {
      name: FIXTURE.billingPlan.name,
      monthlyPrice: FIXTURE.billingPlan.monthlyPrice,
      shopifyPlanName: FIXTURE.billingPlan.shopifyPlanName
    },
    create: FIXTURE.billingPlan
  });

  await prisma.billingSubscription.deleteMany({ where: { storeId: store.id } });
  await prisma.billingSubscription.create({
    data: {
      storeId: store.id,
      planId: plan.id,
      ...FIXTURE.subscription
    }
  });

  await prisma.expense.deleteMany({ where: { storeId: store.id } });
  await prisma.expense.createMany({
    data: FIXTURE.recurringExpenses.map((expense) => ({
      storeId: store.id,
      ...expense
    }))
  });

  await prisma.adSpendEntry.deleteMany({ where: { storeId: store.id } });
  await prisma.adSpendEntry.createMany({
    data: FIXTURE.adSpendEntries.map((entry) => ({
      storeId: store.id,
      ...entry
    }))
  });

  const verifiedStore = await prisma.shopifyStore.findUniqueOrThrow({
    where: { id: store.id },
    include: {
      billingSubscriptions: true,
      expenses: true,
      adSpendEntries: true
    }
  });

  if (!verifiedStore.onboardingCompleted) {
    throw new Error("Seed verification failed: onboarding must be completed for first-run UX fixture.");
  }

  if (verifiedStore.billingSubscriptions.length === 0) {
    throw new Error("Seed verification failed: missing BillingSubscription fixture.");
  }

  if (verifiedStore.expenses.length === 0) {
    throw new Error("Seed verification failed: missing recurring Expense fixture.");
  }

  if (verifiedStore.adSpendEntries.length === 0) {
    throw new Error("Seed verification failed: missing AdSpendEntry fixtures.");
  }

  console.log(
    `Seed complete for ${verifiedStore.shopDomain}: ` +
      `${verifiedStore.billingSubscriptions.length} billing subscription, ` +
      `${verifiedStore.expenses.length} expenses, ` +
      `${verifiedStore.adSpendEntries.length} ad spend entries.`
  );
}

main().finally(() => prisma.$disconnect());
