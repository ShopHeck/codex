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
The app requires all variables defined in `.env.example` and fails fast at startup if any are missing.

### Required variables (baseline)
| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Yes | Public app origin used by embedded app links, OAuth callbacks, and webhook registration. |
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma. |
| `SHOPIFY_API_KEY` | Yes | Shopify app client ID from Partner Dashboard. |
| `SHOPIFY_API_SECRET` | Yes | Shopify app client secret used for OAuth + webhook verification. |
| `SHOPIFY_SCOPES` | Yes | Comma-separated Admin API scopes granted during install. |
| `SHOPIFY_API_VERSION` | Yes | Shopify Admin API version (for example `2025-10`). |
| `SESSION_JWT_SECRET` | Yes | Secret used to sign/verify embedded session JWTs. |

### Environment config matrix (Local, Staging, Pre-Prod)
Use `.env.example` as the baseline contract for every environment.

| Variable | Local (developer tunnel) | Staging | Pre-Prod |
| --- | --- | --- | --- |
| `APP_URL` | `https://real-profit-dev.ngrok-free.app` | `https://staging.realprofit.example.com` | `https://preprod.realprofit.example.com` |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/real_profit` | `postgresql://staging_user:<password>@staging-db.internal:5432/real_profit` | `postgresql://preprod_user:<password>@preprod-db.internal:5432/real_profit` |
| `SHOPIFY_API_KEY` | `shpka_local_12345` | `shpka_staging_12345` | `shpka_preprod_12345` |
| `SHOPIFY_API_SECRET` | `shpss_local_replace_me` | `shpss_staging_replace_me` | `shpss_preprod_replace_me` |
| `SHOPIFY_SCOPES` | `read_orders,read_products,read_analytics,read_fulfillments,read_customers` | Same as local unless explicitly approved change | Same as staging |
| `SHOPIFY_API_VERSION` | `2025-10` | `2025-10` | `2025-10` |
| `SESSION_JWT_SECRET` | `local_session_jwt_secret_min_32_chars` | `staging_session_jwt_secret_min_32_chars` | `preprod_session_jwt_secret_min_32_chars` |

> Keep scopes and API version aligned across Local, Staging, and Pre-Prod unless there is a deliberate rollout plan.

## Operational runbook

### APP_URL + Shopify Partner settings (must match exactly)
`APP_URL` must always be the same deployed/tunnel origin configured in Shopify Partner settings for the same environment.

For example, if `APP_URL=https://real-profit-dev.ngrok-free.app`, configure:
- **App URL:** `https://real-profit-dev.ngrok-free.app/install`
- **Allowed redirection URL(s):** `https://real-profit-dev.ngrok-free.app/api/auth/callback`
- **Webhook endpoint URL:** `https://real-profit-dev.ngrok-free.app/api/shopify/webhooks`

For staging, if `APP_URL=https://staging.realprofit.example.com`, configure:
- **App URL:** `https://staging.realprofit.example.com/install`
- **Allowed redirection URL(s):** `https://staging.realprofit.example.com/api/auth/callback`
- **Webhook endpoint URL:** `https://staging.realprofit.example.com/api/shopify/webhooks`

For pre-prod, if `APP_URL=https://preprod.realprofit.example.com`, configure:
- **App URL:** `https://preprod.realprofit.example.com/install`
- **Allowed redirection URL(s):** `https://preprod.realprofit.example.com/api/auth/callback`
- **Webhook endpoint URL:** `https://preprod.realprofit.example.com/api/shopify/webhooks`

### Secret rotation notes
- Rotate `SHOPIFY_API_SECRET` and `SESSION_JWT_SECRET` on a scheduled cadence (for example, every 90 days) and immediately after any suspected exposure.
- Rotation order:
  1. Generate a new secret in the secret manager.
  2. Update environment variable in target environment.
  3. Update Shopify Partner Dashboard client secret when rotating `SHOPIFY_API_SECRET`.
  4. Redeploy/restart the app so runtime config reloads.
  5. Verify OAuth install/callback and authenticated embedded navigation.
- Expect session invalidation after `SESSION_JWT_SECRET` rotation (users may need to re-authenticate).

## Local development
1. `nvm use` (uses `.nvmrc`, Node 20)
2. `npm run repair`
3. Review `.env` and update values as needed

Manual setup if preferred:
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
