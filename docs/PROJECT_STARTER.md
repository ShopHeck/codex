# PROJECT_STARTER.md

## Real Profit AI for Shopify — Project Starter

This document is the execution guide for building the MVP with Codex.

It is designed to do four things:
1. lock the product and engineering decisions that should not drift
2. define the initial repo structure
3. provide the first implementation sequence
4. give copy-paste prompts for Codex

---

## 1. Product objective

Build an embedded Shopify app that shows merchants their true profit after major variable expenses, then surfaces clear actions to cut losses and increase profit.

### Core promise
**See your real Shopify profit by product after fees, shipping, refunds, discounts, and ad spend.**

### MVP business outcome
A merchant installs the app and reaches a first-value moment where they can immediately see:
- revenue
- real profit
- revenue-to-profit gap
- top profitable products
- top unprofitable products
- biggest leaks
- 3 concrete actions with dollar impact

---

## 2. Non-negotiable product rules

These are fixed unless deliberately changed in the spec.

### 2.1 Canonical profit formula

```ts
ContributionProfit =
  GrossSales
  - Discounts
  - Refunds
  - COGS
  - ShippingCost
  - PaymentProcessingFees
  - TransactionFees
  - AdSpendAllocation
  - VariableCosts
```

Optional future extension:

```ts
NetProfitAfterOverhead =
  ContributionProfit
  - FixedCostAllocation
```

### 2.2 Rules
- COGS uses fulfilled quantity, not ordered quantity.
- Discounts are allocated proportionally across line items.
- Refunds reduce revenue and reverse COGS proportionally for refunded units.
- Shipping cost remains unless shipping was explicitly refunded.
- Shipping source priority:
  1. imported exact shipping cost
  2. rules-based estimate
  3. blended average fallback
- Fee rules support percentage fee, flat fee, and optional Shopify transaction fee.
- Ad allocation supports:
  - none
  - revenue weighted
  - order channel weighted
  - product sales share weighted
- Variable costs support:
  - per order
  - per item
- Every computed output includes a confidence score.

### 2.3 Confidence score model

Start at `100`, then subtract penalties.

```ts
Missing unit cost on any included line item: -25
Estimated shipping used: -10
No ad data while ad allocation expected: -15
Missing fee rule: -10
Refund mapping incomplete: -10
```

Bands:
- `90–100` Accurate
- `75–89` Good estimate
- `50–74` Usable but incomplete
- `<50` Low confidence

### 2.4 Product status rules
- **Scale**: strong margin, low refund rate, positive trend
- **Healthy**: profitable, acceptable leak profile
- **Needs Fix**: profitable but shipping/discount/refund drag is elevated
- **Cut Candidate**: negative or near-zero profit after adjustments

### 2.5 Recommendation categories
- Cut
- Fix
- Scale
- Add

Every recommendation must include:
- title
- category
- target entity
- summary
- why bullets
- estimated monthly impact
- confidence score
- action CTA

No recommendation may be shown without a dollar impact.

---

## 3. Tech stack

### Required stack
- Shopify embedded app
- React Router
- TypeScript
- Node.js
- PostgreSQL
- Prisma
- Redis-backed queue or equivalent job system
- Shopify GraphQL Admin API
- Shopify webhooks
- Shopify App Bridge
- Shopify Polaris or Shopify-aligned UI
- OpenAI only for explanation/formatting layer

### Do not build in MVP
- bookkeeping-grade accounting
- tax compliance workflows
- multi-touch attribution modeling
- advanced 3PL reconciliation
- multi-store admin
- forecast simulator

---

## 4. Repo structure

Use this as the initial target structure.

```text
/apps
  /web
    /app
      /components
        AiSummaryPanel.tsx
        ConfidenceBadge.tsx
        DateRangePicker.tsx
        KpiCard.tsx
        LeakCard.tsx
        LossCard.tsx
        ProductDrawer.tsx
        ProductFiltersBar.tsx
        ProductTable.tsx
        ProfitTrendChart.tsx
        ProfitWaterfallChart.tsx
        RecommendationCard.tsx
        SyncStatusBadge.tsx
        TopProductsPanel.tsx
      /lib
        auth.server.ts
        db.server.ts
        money.ts
        ranges.ts
        shopify.server.ts
      /routes
        app._index.tsx
        app.products.tsx
        app.products.$id.tsx
        app.leaks.tsx
        app.actions.tsx
        app.settings.tsx
        app.onboarding.tsx
        api.dashboard.ts
        api.products.ts
        api.product.$id.ts
        api.leaks.ts
        api.actions.ts
        api.settings.ts
        api.import.costs.ts
        api.sync.full.ts
        webhooks.orders.create.ts
        webhooks.orders.updated.ts
        webhooks.refunds.create.ts
        webhooks.app.uninstalled.ts
    package.json
    tsconfig.json

/packages
  /db
    schema.prisma
    seed.ts
  /profit-engine
    src/
      calculateOrderProfit.ts
      allocateDiscounts.ts
      allocateShipping.ts
      allocateFees.ts
      allocateAdSpend.ts
      allocateVariableCosts.ts
      computeConfidence.ts
      buildSnapshots.ts
      index.ts
  /recommendation-engine
    src/
      rules/
        cutRules.ts
        fixRules.ts
        scaleRules.ts
        addRules.ts
      explainRecommendation.ts
      index.ts
  /workers
    src/
      queues.ts
      jobs/
        backfillOrdersWorker.ts
        backfillProductsWorker.ts
        recomputeOrderProfitWorker.ts
        recomputeProductSnapshotsWorker.ts
        generateRecommendationsWorker.ts
        repairDataWorker.ts
      index.ts
  /shared
    src/
      enums.ts
      types.ts
      constants.ts
      schemas.ts
      index.ts

/docs
  SPEC.md
  PROJECT_STARTER.md
  API_CONTRACT.md
  PROFIT_RULES.md
```

---

## 5. Environment variables

Create a `.env` with placeholders.

```bash
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
SHOPIFY_SCOPES=
DATABASE_URL=
REDIS_URL=
OPENAI_API_KEY=
ENCRYPTION_KEY=
SESSION_SECRET=
NODE_ENV=development
```

---

## 6. Initial Prisma schema target

Create these models first.

### Core models
- Store
- Product
- Variant
- Order
- OrderLineItem
- Refund
- ShippingCost
- Fee
- AdSpendDaily
- OrderAttribution
- VariableCostRule
- ProfitSnapshot
- Recommendation
- SyncJob

### Minimum useful fields per model

#### Store
- id
- shopifyShopId
- shopDomain
- accessTokenEncrypted
- currencyCode
- timezone
- planName
- onboardingCompleted
- createdAt
- updatedAt

#### Product
- id
- storeId
- shopifyProductId
- title
- vendor
- productType
- status
- createdAt
- updatedAt

#### Variant
- id
- storeId
- productId
- shopifyVariantId
- title
- sku
- weight
- weightUnit
- unitCostSource
- unitCost
- unitCostConfidence
- createdAt
- updatedAt

#### Order
- id
- storeId
- shopifyOrderId
- orderNumber
- processedAt
- currencyCode
- grossSales
- discountsTotal
- refundsTotal
- taxTotal
- shippingCharged
- gatewayName
- financialStatus
- fulfillmentStatus
- sourceChannel
- customerType
- createdAt
- updatedAt

#### OrderLineItem
- id
- orderId
- variantId
- productId
- title
- quantityOrdered
- quantityFulfilled
- quantityRefunded
- unitPrice
- grossSales
- discountAllocated
- refundAllocated
- taxAllocated
- cogsAllocated
- shippingAllocated
- feeAllocated
- adSpendAllocated
- variableCostAllocated
- netProfit
- marginPercent
- createdAt
- updatedAt

#### Refund
- id
- storeId
- orderId
- shopifyRefundId
- processedAt
- productRefundAmount
- shippingRefundAmount
- taxRefundAmount
- createdAt
- updatedAt

#### ShippingCost
- id
- storeId
- orderId
- sourceType
- estimated
- amount
- ruleVersion
- createdAt
- updatedAt

#### Fee
- id
- storeId
- orderId
- paymentFee
- transactionFee
- feeRuleVersion
- createdAt
- updatedAt

#### AdSpendDaily
- id
- storeId
- date
- channel
- campaignId
- campaignName
- spend
- imported
- createdAt
- updatedAt

#### OrderAttribution
- id
- storeId
- orderId
- channel
- campaign
- source
- medium
- attributionConfidence
- createdAt
- updatedAt

#### VariableCostRule
- id
- storeId
- name
- amount
- appliesPerOrder
- appliesPerItem
- enabled
- createdAt
- updatedAt

#### ProfitSnapshot
- id
- storeId
- entityType
- entityId
- periodStart
- periodEnd
- revenue
- discounts
- refunds
- cogs
- shippingCost
- fees
- adSpend
- variableCosts
- contributionProfit
- fixedCostAllocated
- netProfit
- netMarginPercent
- confidenceScore
- createdAt
- updatedAt

#### Recommendation
- id
- storeId
- entityType
- entityId
- category
- title
- summary
- whyJson
- estimatedMonthlyImpact
- confidenceScore
- status
- createdAt
- updatedAt

#### SyncJob
- id
- storeId
- jobType
- status
- startedAt
- finishedAt
- metaJson

### Important indexes
Add indexes for:
- `storeId`
- `orderId`
- `productId`
- `variantId`
- `processedAt`
- `periodStart + periodEnd`
- `category`
- `status`

---

## 7. App routes

Create these routes immediately.

### Merchant-facing routes
- `/app`
- `/app/products`
- `/app/products/:id`
- `/app/leaks`
- `/app/actions`
- `/app/settings`
- `/app/onboarding`

### JSON/API routes
- `/api/dashboard`
- `/api/products`
- `/api/products/:id`
- `/api/leaks`
- `/api/actions`
- `/api/settings`
- `/api/import/costs`
- `/api/sync/full`

### Webhook routes
- `/webhooks/orders/create`
- `/webhooks/orders/updated`
- `/webhooks/refunds/create`
- `/webhooks/app/uninstalled`

---

## 8. UI blueprint by route

## 8.1 Overview page

### Must show above the fold
- Net Profit
- Net Margin %
- Profit per Order
- Revenue vs Profit Gap

### Second row
- Refund Loss
- Shipping Loss
- Discount Loss

### Third row
- Revenue vs Net Profit trend chart
- Profit waterfall chart

### Fourth row
- Top 5 most profitable products
- Top 5 products destroying profit

### Fifth row
- AI summary panel with 3 actions

### Acceptance criteria
- All 4 KPIs visible without scrolling on desktop
- Top 5 winners and losers visible on initial load
- AI summary shows 3 actions with dollar impact
- Dashboard date range changes recalculate all widgets

---

## 8.2 Products page

### Components
- search
- filters
- sortable profitability table
- side drawer for product detail

### Core columns
- Product
- Units Sold
- Revenue
- Net Profit
- Margin %
- Refund Rate
- Shipping Burden
- Ad-adjusted Margin
- Status

### Drawer tabs
- Summary
- Breakdown
- Refunds
- Trend
- AI Insight

### Acceptance criteria
- table sorts correctly
- filters combine correctly
- drawer opens accurate product-level breakdown
- status badge clearly labels product as Scale / Healthy / Needs Fix / Cut Candidate

---

## 8.3 Leaks page

### Must show
- Refund leak
- Shipping leak
- Discount leak
- Fee leak
- Ad leak

### Supporting sections
- biggest leak highlight
- ranked issue list
- projected impact panel

### Acceptance criteria
- each leak card shows dollars lost and percent of revenue
- ranked issue list is plain-language, not jargon-heavy
- projected impact visible for top 3 issues

---

## 8.4 AI Actions page

### Tabs
- Cut
- Fix
- Scale
- Add

### Card requirements
- title
- summary
- why bullets
- estimated monthly impact
- confidence
- buttons for save / dismiss / open target

### Acceptance criteria
- every recommendation includes dollar impact
- every recommendation includes confidence score
- tabs filter cards by category
- save and dismiss persist

---

## 8.5 Settings page

### Sections
- integrations
- profit rules
- confidence center
- CSV import

### Must support
- cost source selection
- shipping rule selection
- fee rule config
- ad allocation config
- variable cost rules
- confidence guidance

### Acceptance criteria
- settings save correctly
- missing data is translated into clear user actions
- confidence center identifies highest-impact data gaps

---

## 8.6 Onboarding flow

### Step 1
Welcome and value proposition

### Step 2
Initial sync progress

### Step 3
Cost setup
Options:
- use Shopify cost
- upload CSV
- fill top sellers only
- skip for now

### Step 4
Profit mode
- Fast estimate
- Balanced
- Precision

### Step 5
First reveal
Show:
- revenue
- real profit
- gap
- top 3 products hurting profit
- 3 recommendations

### Acceptance criteria
- user can reach first reveal without completing every step
- estimate mode still produces dashboard
- reveal moment feels immediate and high-value

---

## 9. API contract starter

## 9.1 GET /api/dashboard?range=30d

Response shape:

```ts
type DashboardResponse = {
  range: "7d" | "30d" | "90d" | "custom";
  confidence: {
    score: number;
    label: "Accurate" | "Good estimate" | "Usable but incomplete" | "Low confidence";
  };
  sync: {
    status: "healthy" | "syncing" | "error";
    lastSyncedAt: string | null;
  };
  kpis: {
    netProfit: number;
    netMarginPercent: number;
    profitPerOrder: number;
    revenueProfitGap: number;
  };
  leaks: {
    refundLoss: number;
    shippingLoss: number;
    discountLoss: number;
  };
  trend: Array<{
    date: string;
    revenue: number;
    netProfit: number;
  }>;
  waterfall: {
    revenue: number;
    discounts: number;
    refunds: number;
    cogs: number;
    shipping: number;
    fees: number;
    adSpend: number;
    variableCosts: number;
    netProfit: number;
  };
  topWinners: Array<{
    productId: string;
    title: string;
    netProfit: number;
    marginPercent: number;
  }>;
  topLosers: Array<{
    productId: string;
    title: string;
    netProfit: number;
    marginPercent: number;
  }>;
  aiSummary: Array<{
    id: string;
    title: string;
    category: "cut" | "fix" | "scale" | "add";
    estimatedMonthlyImpact: number;
    confidenceScore: number;
  }>;
};
```

## 9.2 GET /api/products

Supports:
- range
- search query
- vendor
- collection
- type
- status
- sort
- direction
- page
- pageSize

## 9.3 GET /api/products/:id

Returns:
- product summary
- trend series
- leak details
- refund details
- recommendation list

## 9.4 GET /api/leaks

Returns:
- leak cards
- top issues
- projected impact

## 9.5 GET /api/actions

Supports:
- range
- category
- status

Returns recommendation cards.

---

## 10. Background jobs

Create these workers.

### High priority
- `recomputeOrderProfitWorker`
- `recomputeProductSnapshotsWorker`

### Medium priority
- `backfillOrdersWorker`
- `backfillProductsWorker`

### Low priority
- `generateRecommendationsWorker`
- `repairDataWorker`

### Queue priorities
- webhook-triggered recompute: high
- onboarding first sync: high
- nightly repair sync: medium
- recommendation refresh: low

---

## 11. Shopify sync strategy

### On install
- start 90-day backfill
- sync products and variants
- detect cost coverage
- queue first recommendation build

### On `orders/create`
- ingest order
- compute order economics
- refresh affected product snapshots

### On `orders/updated`
- update order
- recompute economics
- refresh affected product snapshots

### On `refunds/create`
- ingest refund
- recompute affected order
- refresh product snapshots
- refresh recommendations if needed

### Nightly job
- repair previous 7 days
- recalc recent snapshots
- rerun recommendations

---

## 12. First implementation sequence

This is the recommended build order.

### Phase 1 — Foundation
1. scaffold Shopify embedded app shell
2. add left nav and top utility bar
3. configure Prisma and database connection
4. create base schema and migrations
5. seed default store settings

### Phase 2 — Profit engine
6. implement discount allocation
7. implement COGS allocation
8. implement refund handling
9. implement shipping allocation
10. implement fee allocation
11. implement variable cost allocation
12. implement confidence scoring
13. implement order-level profit calculation
14. implement product snapshot aggregation

### Phase 3 — Core UI
15. build Overview page with mock data
16. wire Overview to real data
17. build Products page and drawer
18. build Leaks page
19. build AI Actions page
20. build Settings page
21. build Onboarding flow

### Phase 4 — Platform integration
22. implement webhooks
23. implement queues/workers
24. add CSV cost import
25. add sync status and repair paths

### Phase 5 — Recommendation layer
26. implement deterministic rules
27. save generated recommendations
28. add explanation formatter using OpenAI

### Phase 6 — Hardening
29. add unit tests for profit math
30. add API integration tests
31. add UI smoke tests
32. test onboarding path with incomplete data

---

## 13. Definition of done for MVP

MVP is done when:
- merchant can install app
- 90-day data backfill runs
- dashboard shows real profit metrics
- products page shows profitability table
- leaks page shows main leak categories
- actions page shows deterministic recommendations with dollar impact
- onboarding reaches first reveal
- confidence score appears across main views
- webhook-driven updates work
- CSV cost import works
- core profit math is covered by tests

---

## 14. Initial Codex prompt pack

Use these as the first prompts in sequence.

## Prompt 1 — Scaffold the app
Build a Shopify embedded app using React Router, TypeScript, Prisma, and PostgreSQL. Create merchant routes for Overview, Products, Leaks, AI Actions, Settings, and Onboarding. Add a left navigation and a top utility bar with date range, sync status, and confidence badge. Keep the code production-oriented and strongly typed.

## Prompt 2 — Create database models
Create a Prisma schema for a Shopify profit analytics app with models for Store, Product, Variant, Order, OrderLineItem, Refund, ShippingCost, Fee, AdSpendDaily, OrderAttribution, VariableCostRule, ProfitSnapshot, Recommendation, and SyncJob. Include indexes optimized for store, order, product, variant, and date-range queries. Generate migrations.

## Prompt 3 — Implement profit engine
Create a TypeScript profit engine that computes contribution profit at order and line-item level using this formula: gross sales minus discounts minus refunds minus COGS minus shipping cost minus payment fees minus transaction fees minus ad spend allocation minus variable costs. Add shipping fallback logic, configurable ad allocation, and confidence scoring.

## Prompt 4 — Build Overview page
Build the Overview page using server-loaded data. Include KPI cards, leak cards, a revenue versus net profit trend chart, a waterfall chart, top profitable products, top unprofitable products, and an AI summary panel. Keep the layout admin-native and responsive.

## Prompt 5 — Build Products page
Create a Products page with search, filters, sortable profitability table, and a drawer for product detail. Include status badges for Scale, Healthy, Needs Fix, and Cut Candidate. The drawer must include tabs for Summary, Breakdown, Refunds, Trend, and AI Insight.

## Prompt 6 — Build Leaks page
Create a Leaks page showing leak cards for refund, shipping, discount, fee, and ad leakage. Add a biggest leak highlight, a ranked issue list, and a projected impact section with plain-language explanations.

## Prompt 7 — Build AI Actions
Implement a deterministic recommendation engine with categories cut, fix, scale, and add. Build a UI page that displays recommendation cards with summary, reason bullets, dollar impact, confidence, and actions to save, dismiss, or open the target entity.

## Prompt 8 — Build onboarding
Create a 5-step onboarding wizard: welcome, sync progress, cost setup, profit mode, and first reveal. The first reveal must show revenue, real profit, revenue-profit gap, top 3 products hurting profit, and 3 recommendations.

## Prompt 9 — Implement webhooks and jobs
Add Shopify webhook handlers for orders/create, orders/updated, refunds/create, and app/uninstalled. Add job queue workers for backfill, recompute, recommendation generation, and repair. Recompute affected entities when events arrive.

## Prompt 10 — Add tests
Add unit tests for discount allocation, COGS calculation, refund handling, shipping fallback, fee allocation, ad allocation, and confidence scoring. Add API tests for dashboard, products, leaks, and actions.

---

## 15. Lock file for business logic

Create a file at `/docs/PROFIT_RULES.md` and mirror these rules there so Codex does not improvise.

Minimum contents:
- formula
- allocation rules
- confidence penalties
- product status thresholds
- recommendation thresholds
- leak thresholds
- first reveal metrics

This file should be treated as the source of truth for business logic.

---

## 16. Initial thresholds to hardcode

These are starting defaults. Expose them later in admin config.

### Product statuses
```ts
SCALE_MIN_MARGIN_PERCENT = 25
SCALE_MAX_REFUND_RATE_PERCENT = 5

HEALTHY_MIN_MARGIN_PERCENT = 12

NEEDS_FIX_MAX_MARGIN_PERCENT = 12
NEEDS_FIX_MIN_MARGIN_PERCENT = 0

CUT_CANDIDATE_MAX_MARGIN_PERCENT = 0
```

### Leak thresholds
```ts
HIGH_SHIPPING_BURDEN_PERCENT = 15
HIGH_DISCOUNT_BURDEN_PERCENT = 20
HIGH_REFUND_RATE_PERCENT = 8
HIGH_FEE_BURDEN_PERCENT = 6
```

### Recommendation thresholds
```ts
MIN_REVENUE_FOR_CUT_ANALYSIS = 500
MIN_NEGATIVE_PROFIT_FOR_CUT = -50
MIN_MARGIN_FOR_SCALE = 25
MAX_REFUND_RATE_FOR_SCALE = 5
```

These should live in `/packages/shared/src/constants.ts`.

---

## 17. Example first reveal copy

Use this structure in onboarding.

### Headline
**You made ${revenue} in revenue, but only ${netProfit} in real profit.**

### Subheadline
**Here’s what’s eating the difference.**

### Show
- Discounts: `${x}`
- Refunds: `${x}`
- Shipping: `${x}`
- Fees: `${x}`
- Ads: `${x}`

### Then show
- top 3 profit-destroying products
- 3 recommendations with estimated monthly upside

This page is the main conversion moment.

---

## 18. Developer guardrails

Do not allow Codex to:
- invent alternative profit formulas
- invent recommendation categories
- hide missing data without reducing confidence
- show generic AI text without quantified impact
- overcomplicate settings early
- build tax/accounting workflows into MVP
- over-design custom UI when Shopify-native components will do

---

## 19. Immediate next repo files to create

Create these files first:

```text
/docs/SPEC.md
/docs/PROJECT_STARTER.md
/docs/PROFIT_RULES.md
/apps/web/app/routes/app._index.tsx
/apps/web/app/routes/app.products.tsx
/apps/web/app/routes/app.leaks.tsx
/apps/web/app/routes/app.actions.tsx
/apps/web/app/routes/app.settings.tsx
/apps/web/app/routes/app.onboarding.tsx
/packages/db/schema.prisma
/packages/profit-engine/src/calculateOrderProfit.ts
/packages/recommendation-engine/src/index.ts
/packages/shared/src/constants.ts
```

---

## 20. Final instruction for Codex

Build the app in layers:
1. app shell
2. database
3. profit engine
4. dashboard
5. product analytics
6. leaks
7. actions
8. onboarding
9. sync and webhooks
10. tests

Do not optimize for elegance before the first reveal works.

Optimize for:
- speed to first merchant value
- trustworthy math
- clear money impact
- embedded Shopify-native UX
