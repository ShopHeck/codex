# Shopify install flow troubleshooting

This guide documents the expected request chain for app installation and the failure outcomes used for triage.

## Route chain to validate

1. `/install`
2. `/api/auth/start?shop=<shop-domain>`
3. `/api/auth/callback`
4. `/api/billing/status`

## Expected redirects by route

### `/install`
- **Success path:** User submits a valid `shop` domain and is sent to `/api/auth/start`.
- **Failure path:** Page can display query-parameter errors from other routes (for example `?error=invalid_state`).

### `/api/auth/start?shop=<shop-domain>`
- **Success path:** Redirects to Shopify OAuth authorize URL and sets `oauth_state` cookie (HTTP-only, 5 minute TTL).
- **Failure path:** Redirects to `/install?error=invalid_shop` when domain normalization fails.

### `/api/auth/callback`
- **Success path:** Verifies HMAC + state, exchanges token, persists store token, clears `oauth_state`, sets `rp_session`, redirects to `/api/billing/status`.
- **Failure path:**
  - `/install?error=missing_oauth_params` when `code` or `shop` is missing.
  - `/install?error=invalid_hmac` when callback signature does not validate.
  - `/install?error=invalid_state` when `oauth_state` cookie is missing or mismatched.
  - `/install?error=invalid_shop` when callback `shop` cannot be normalized.
  - `/install?error=token_exchange_failed` when Shopify token exchange or DB upsert fails.

### `/api/billing/status`
- **Success path:** Active billing redirects to `/onboarding`; inactive billing redirects to Shopify confirmation URL.
- **Failure path:** Missing/invalid `rp_session` redirects to `/install?error=missing_session`.

## Common failures and checks

### Invalid HMAC (`error=invalid_hmac`)
- Ensure `SHOPIFY_API_SECRET` exactly matches Partner dashboard client secret.
- Ensure callback query string is unmodified before reaching app.
- Confirm `APP_URL` callback endpoint exactly matches allowed redirect URL in Partner dashboard.

### Invalid state (`error=invalid_state`)
- Verify `oauth_state` cookie is present on callback request.
- Confirm cookie domain/protocol matches app origin (especially when switching tunnels).
- Complete OAuth within 5 minutes before state cookie expires.

### Missing session (`error=missing_session`)
- Confirm callback response sets `rp_session` cookie.
- Confirm browser allows first-party cookies for the app origin.
- Re-run install flow if `SESSION_JWT_SECRET` was rotated (old sessions become invalid).

### Shop domain normalization (`error=invalid_shop`)
- Use `<shop>.myshopify.com` in install form.
- Avoid admin/storefront URLs with extra hostnames.
- The app normalizes case and strips protocol/path, but non-`myshopify.com` hosts are rejected.

