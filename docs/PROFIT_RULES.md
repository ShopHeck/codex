# PROFIT_RULES.md

## Real Profit AI — Locked Business Logic Rules

This document defines the **source of truth** for all profit calculations, allocations, and decision logic.

These rules must NOT be modified without updating this file.

---

# 1. Core Philosophy

This is NOT accounting software.

This is:
**Operational profit intelligence**

Goals:
- directional accuracy over perfection
- consistent logic across all views
- explainable calculations
- actionable outputs tied to money

---

# 2. Canonical Profit Formula

## 2.1 Contribution Profit (Primary Metric)

```
Contribution Profit =
  Gross Sales
  - Discounts
  - Refunds
  - COGS
  - Shipping Cost
  - Payment Processing Fees
  - Transaction Fees
  - Ad Spend Allocation
  - Variable Costs
```

## 2.2 Net Profit (Optional Extension)

```
Net Profit =
  Contribution Profit
  - Fixed Cost Allocation
```

MVP uses **Contribution Profit** as primary.

---

# 3. Definitions

## Gross Sales
- sum of (unit price × quantity ordered)
- before discounts

## Discounts
- all order-level and line-level discounts
- must be allocated proportionally to line items

## Refunds
Includes:
- product refunds
- shipping refunds
- tax refunds

## Net Revenue
```
Net Revenue = Gross Sales - Discounts - Refunds
```

## COGS
- cost per unit × fulfilled quantity
- not ordered quantity

## Shipping Cost
True cost to fulfill order:
- carrier label cost
- packaging cost
- handling cost

## Fees
- payment processing fees (Stripe, Shopify Payments, etc.)
- Shopify transaction fees (if external gateway)

## Ad Spend
- allocated cost of acquisition

## Variable Costs
- per-order or per-item costs
Examples:
- pick & pack
- packaging
- per-order SaaS

---

# 4. Allocation Rules

## 4.1 Discount Allocation

Rule:
- distribute proportionally by line item revenue

```
lineDiscount = (lineRevenue / totalOrderRevenue) × totalDiscount
```

Required for:
- accurate product profit
- margin consistency

---

## 4.2 Refund Allocation

Rules:
- reduce revenue for refunded amount
- reverse COGS proportionally based on refunded quantity
- shipping cost remains unless refunded

Per line item:
```
refundedQuantity = refunded units
cogsReversal = unitCost × refundedQuantity
```

---

## 4.3 COGS Allocation

Rules:
- use fulfilled quantity
- not ordered quantity
- fallback if missing cost:
  - use default cost %
  - reduce confidence score

---

## 4.4 Shipping Cost Allocation

Priority order:

### 1. Exact
- imported from shipping provider / 3PL

### 2. Rule-based
- flat per order
- weight-based
- product override

### 3. Blended average
- average shipping cost over last 30 days

---

## 4.5 Fee Allocation

Payment fee:
```
paymentFee = orderRevenue × feePercent + fixedFee
```

Transaction fee:
```
transactionFee = orderRevenue × transactionPercent
```

Allocate to line items proportionally.

---

## 4.6 Ad Spend Allocation

Supported modes:

### Mode 1: None
- no ad spend included

### Mode 2: Revenue-weighted
```
orderAdSpend = (orderRevenue / totalRevenueForPeriod) × totalAdSpend
```

### Mode 3: Channel-weighted
- allocate based on source channel

### Mode 4: Product-weighted (future)
- allocate based on product revenue share

---

## 4.7 Variable Cost Allocation

Support:
- per order
- per item

Examples:
```
perOrderCost = flat amount
perItemCost = unit cost × quantity
```

---

# 5. Product-Level Profit

Product profit must include ALL allocations:

```
Product Profit =
  Revenue
  - Discount Allocation
  - Refund Allocation
  - COGS
  - Shipping Allocation
  - Fee Allocation
  - Ad Allocation
  - Variable Costs
```

---

# 6. Product Status Rules

## Scale
- margin ≥ 25%
- refund rate < 5%
- positive trend

## Healthy
- margin ≥ 12%

## Needs Fix
- margin between 0–12%
- or high shipping/discount burden

## Cut Candidate
- margin ≤ 0
- or negative contribution profit

---

# 7. Leak Definitions

## Refund Leak
- total refunds / revenue

## Shipping Leak
- shipping cost / revenue

## Discount Leak
- discounts / revenue

## Fee Leak
- fees / revenue

## Ad Leak
- ad spend / revenue

---

# 8. Confidence Score

Start at 100.

Subtract penalties:

```
Missing unit cost: -25
Estimated shipping used: -10
No ad data when expected: -15
Missing fee rule: -10
Incomplete refund mapping: -10
```

### Confidence bands

- 90–100 → Accurate
- 75–89 → Good estimate
- 50–74 → Usable but incomplete
- <50 → Low confidence

---

# 9. Recommendation Rules

## 9.1 Cut

Trigger:
- revenue > threshold
- net profit < 0
- refund rate high OR ad-adjusted margin negative

---

## 9.2 Fix

Trigger:
- shipping cost high %
- discount dependency high
- margin positive before ads but negative after ads

---

## 9.3 Scale

Trigger:
- margin > 25%
- low refund rate
- strong trend

---

## 9.4 Add

Trigger:
- identify high-performing price bands
- identify category gaps
- adjacent product opportunities

---

# 10. Threshold Defaults

```
HIGH_SHIPPING_PERCENT = 15
HIGH_DISCOUNT_PERCENT = 20
HIGH_REFUND_PERCENT = 8
HIGH_FEE_PERCENT = 6

SCALE_MARGIN = 25
HEALTHY_MARGIN = 12
CUT_MARGIN = 0
```

---

# 11. First Reveal Requirements

Must show:

- revenue
- real profit
- revenue vs profit gap
- top 3 losing products
- 3 recommendations

---

# 12. Non-Negotiables

- All product profit must include full cost allocation
- No recommendation without dollar impact
- Missing data must reduce confidence
- Estimates must be clearly indicated
- Never show misleading profit (e.g. COGS-only margin)

---

# 13. Future Extensions (Not MVP)

- LTV-based profit
- cohort profitability
- multi-touch attribution
- forecasting
- inventory + profit optimization

---

## End of File
