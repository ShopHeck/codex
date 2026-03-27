# SPEC.md

## Real Profit AI for Shopify — Product Specification

---

## 1. Product Overview

Real Profit AI is a Shopify embedded app that shows merchants their **true net profit** after all meaningful expenses and provides **clear, actionable recommendations** to improve profitability.

### Core problem
Shopify merchants optimize for revenue, not profit. Existing tools fail to:
- include all costs (shipping, refunds, fees, ads)
- show profit at the product level
- provide clear actions tied to money impact

### Solution
A profit intelligence layer that:
- calculates real profit
- identifies leaks
- surfaces product-level performance
- recommends actions with quantified impact

---

## 2. Core Value Proposition

**Primary:**
See your real profit after all costs.

**Secondary:**
Know exactly what to cut, fix, and scale.

---

## 3. Target User

Primary:
- Shopify store owners doing $10K–$5M/month

Secondary:
- ecommerce operators
- media buyers
- founders managing product catalogs

---

## 4. Key Features (MVP)

### 4.1 Profit Dashboard
- Net Profit
- Net Margin %
- Profit per Order
- Revenue vs Profit gap
- Profit trend over time

### 4.2 Product-Level Profitability
- Profit by product and variant
- Margin %
- Refund-adjusted performance
- Ad-adjusted performance
- Status labeling (Scale / Healthy / Fix / Cut)

### 4.3 Leak Detection
- Refund leakage
- Shipping leakage
- Discount leakage
- Fee leakage
- Ad leakage

### 4.4 AI Actions
- Cut products losing money
- Fix margin compression
- Scale profitable SKUs
- Recommend new product opportunities

### 4.5 Confidence Scoring
- Indicates data completeness and reliability
- Guides user to improve accuracy

---

## 5. Profit Calculation

### Formula

Contribution Profit:

Revenue
- Discounts
- Refunds
- COGS
- Shipping cost
- Payment fees
- Transaction fees
- Ad spend
- Variable costs

Optional:
- Fixed cost allocation

---

## 6. Data Sources

### Shopify
- orders
- line items
- refunds
- products
- variants
- inventory cost (if available)

### Optional integrations
- Meta Ads
- Google Ads
- shipping providers

### Manual inputs
- product costs
- shipping rules
- fee rules
- variable costs

---

## 7. UX Principles

- Show money impact first
- Avoid accounting complexity
- Prioritize clarity over completeness
- Default to usable estimates
- Make missing data visible but not blocking

---

## 8. Screens

### Overview
- KPIs
- trends
- top winners/losers
- AI summary

### Products
- sortable profit table
- detailed drawer

### Leaks
- categorized loss breakdown
- ranked issues

### AI Actions
- action cards with impact

### Settings
- integrations
- rules
- confidence center

### Onboarding
- fast path to first insight

---

## 9. Onboarding Experience

Goal:
Reach first insight in under 2 minutes.

Steps:
1. connect store
2. sync data
3. optional cost input
4. choose profit mode
5. first reveal

---

## 10. First Reveal Moment

Show:
- revenue
- real profit
- gap
- top 3 losing products
- 3 recommendations

Headline:
"You made X in revenue but only Y in profit."

---

## 11. Recommendation System

Categories:
- Cut
- Fix
- Scale
- Add

Each recommendation includes:
- reason
- impact
- confidence

---

## 12. Differentiators

- profit AFTER ads
- product-level net profit
- leak detection
- action-oriented insights
- confidence scoring

---

## 13. Monetization

Pricing tiers:
- Basic: dashboard
- Growth: product insights
- Pro: AI + integrations

Upsell triggers:
- hidden profit loss
- product inefficiencies

---

## 14. Risks

- incomplete data
- attribution inaccuracies
- merchant misunderstanding of estimates

Mitigation:
- confidence scoring
- clear messaging
- flexible rules

---

## 15. Success Metrics

- activation rate
- time to first insight
- paid conversion
- retention (weekly active usage)
- number of actions taken

---

## 16. Future Expansion

- forecasting
- benchmarking
- LTV-based optimization
- inventory + profit linkage
- automated actions

---

## 17. Positioning

**Not accounting software**

This is:
Profit intelligence for ecommerce operators

---

## 18. One-line pitch

"See your true Shopify profit and know exactly what to fix, cut, and scale."
