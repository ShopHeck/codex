# Real Profit for Shopify

Production-ready public Shopify app (embedded) for true net profit analytics across one or more stores.

## Source of Truth

This repo must follow these documents:

- `docs/SPEC.md`
- `docs/PROJECT_STARTER.md`
- `docs/PROFIT_RULES.md`

Important rules:
- Do not invent alternative profit formulas
- Do not invent alternative recommendation logic
- Do not show product profit without full cost allocation
- Missing data must reduce confidence scores
- No recommendation may be shown without dollar impact

## Local Setup

Install dependencies:
npm install

Run dev:
npm run dev

Run lint:
npm run lint

If lint fails due to Next.js not being available:
- ensure dependencies are installed
- or use: npm run lint:basic

## Product & architecture summary

### Personas
- **Solo merchant:** wants simple daily net profit after all costs.
- **Multi-store operator:** wants one account managing several stores.
- **Agency:** monitors profitability for many client stores and validates ad efficiency.

### Core journeys
1. Merchant discovers app in Shopify App Store, clicks **Add app**, and approves OAuth scopes.
2. App runs billing check; if no active subscription, merchant is redirected to Shopify billing confirmation.
3. Merchant lands on onboarding and configures fees/COGS/expenses/ad spend assumptions.
4. Merchant views dashboard KPIs, daily chart, order-level and product-level profitability.

### Core vs nice-to-have
- **Core delivered:** OAuth, billing, required webhooks, order sync pipeline, profit engine, dashboard/orders/products/settings, multi-store data model.
- **Stubbed nice-to-have:** ad APIs (Meta/Google/TikTok) via `AdsService` interface with manual ad spend implementation.

## High-level architecture
- **Frontend:** Next.js App Router + Tailwind + reusable UI components in embedded admin layout.
- **Backend:** Next.js Route Handlers for OAuth, billing, webhooks, sync, dashboards, settings.
- **Data:** PostgreSQL + Prisma.
- **Shopify integrations:** Admin GraphQL API for billing + webhook ingestion.
- **Compliance:** includes mandatory privacy webhook handling endpoints (`customers/redact`, `customers/data_request`, `shop/redact`) and uninstall handling.

## Database schema (summary)
- `Merchant` (optional account owner identity)
- `ShopifyStore` (shop domain, token, assumptions, onboarding)
- `BillingPlan`, `BillingSubscription` (Shopify App Subscription state)
- `Order`, `OrderItem` snapshots
- `AdSpendEntry`, `Expense`
- `DailyProfitSnapshot`, `ProductProfitSnapshot`

Detailed schema is in `prisma/schema.prisma`.

## Profit calculation logic
Per order, net profit = revenue - (COGS + payment fees + Shopify fees + shipping + prorated recurring app/SaaS fees + ad spend allocation + refunds + other costs).

### Ad spend allocation strategy
- MVP uses **daily manual channel entries** (`AdSpendEntry`).
- Allocation is currently day-based at order date (all same-day spend attributed to same-day orders).
- Future extension point: replace with attributable click/order model in `AdsService`.

## Tech stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL
- Shopify OAuth and GraphQL billing integration
- Vitest for core calculation test

## Environment variables
See `.env.example`.

## Local development
1. `npm install`
2. `cp .env.example .env`
3. Configure Postgres, then run:
   - `npx prisma migrate dev --name init`
   - `npx prisma generate`
   - `npm run prisma:seed`
4. Start app: `npm run dev`
5. Expose local URL via ngrok/cloudflared and set `APP_URL` accordingly.

## Shopify Partner dashboard configuration
In your Partner app (public app):
- **App URL:** `https://<your-domain>/install`
- **Allowed redirection URL(s):** `https://<your-domain>/api/auth/callback`
- **Webhook endpoint URL:** `https://<your-domain>/api/shopify/webhooks`
- Register webhooks for:
  - `orders/create`
  - `orders/updated`
  - `orders/cancelled`
  - `refunds/create`
  - `app/uninstalled`
  - `customers/redact`
  - `customers/data_request`
  - `shop/redact`

## Billing setup (Shopify Billing API only)
- App uses GraphQL `appSubscriptionCreate` recurring plan (Starter @ $29).
- Billing flow:
  1. OAuth callback stores token and session.
  2. `/api/billing/status` checks active subscription.
  3. If none, create Shopify subscription and redirect to `confirmationUrl`.
  4. On callback to `/api/billing/confirm`, activate stored subscription.
- No Stripe/off-platform billing used.

## Deployment (Vercel + managed Postgres)
1. Create managed Postgres (Neon/Supabase/RDS) and set `DATABASE_URL`.
2. Deploy to Vercel and set all env vars from `.env.example`.
3. Run Prisma migration in CI/CD or one-off job:
   - `npx prisma migrate deploy`
   - `npx prisma generate`
4. Update Partner dashboard URLs to production domain.
5. Reinstall app on test shop and confirm billing + webhooks.

## Demo mode / seed fixtures
- Use `npm run prisma:seed` to create demo merchant/store, active subscription, recurring expense, and ad spend entries.
- You can ingest demo orders through webhook endpoint using signed payloads or direct DB inserts.

## App Store listing checklist
- App name: **Real Profit for Shopify** (alternatives: True Net Profit, ProfitLens for Shopify)
- Tagline: “See real net profit in Shopify after ads, fees, shipping, and refunds.”
- Pricing: Starter monthly plan via Shopify billing.
- Required assets: app icon, 3–5 screenshots (Dashboard, Orders, Products, Settings), optional demo video.
- Listing copy should clearly explain: Shopify revenue ≠ true profit; app unifies hidden costs in one view.
- Include privacy policy URL, support URL, and clear data usage disclosure.

## Assumptions documented
- Uses cookie-backed JWT session for embedded admin routes.
- Uses Shopify GraphQL billing in test mode by default; switch `test: false` for production charges after review.
- For MVP, ad spend is manual and day-based allocation.
