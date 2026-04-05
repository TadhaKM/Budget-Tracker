# Security & Privacy Checklist — ClearMoney

Practical checklist for an MVP personal finance app that connects to bank accounts via open banking (TrueLayer). Each item is marked with current status.

---

## 1. Authentication & Session Security

- [x] **Delegated auth to Supabase** — magic link (passwordless), no credentials stored in our DB
- [x] **JWT bearer token validation** on every authenticated route (`plugins/auth.ts`)
- [x] **User lookup after token validation** — maps Supabase ID to internal user, rejects deleted users
- [x] **Token auto-refresh** on mobile via Supabase client (`autoRefreshToken: true`)
- [ ] **Add session timeout** — force re-auth after extended inactivity (e.g. 30 days)
- [ ] **Enable MFA/2FA** — configure TOTP via Supabase Auth for users who opt in
- [ ] **Validate token expiry proactively** — don't rely solely on Supabase `getUser()` network call; verify JWT signature and `exp` claim locally for performance and resilience

## 2. Encryption

- [x] **AES-256-GCM for bank tokens at rest** — random 12-byte IV, 16-byte auth tag, key derived via SHA-256 (`lib/crypto.ts`)
- [x] **Tokens decrypted only at sync time** — never held in plaintext longer than necessary (`services/sync.ts`)
- [x] **Fresh tokens re-encrypted immediately** after provider refresh
- [ ] **Enforce TLS in production** — redirect HTTP → HTTPS, set `Strict-Transport-Security` header
- [ ] **Key rotation strategy** — version the encryption key so old ciphertexts can be re-encrypted with a new key without downtime
- [ ] **Database connection over TLS** — ensure `DATABASE_URL` uses `?sslmode=require` in production

## 3. API Security

- [x] **Centralised error handler** — never leaks stack traces, internal errors, or Prisma details to clients (`plugins/error-handler.ts`)
- [x] **Zod input validation** on route bodies and query params (transactions, budgets, connections, auth)
- [x] **Request ID propagation** — every request gets a UUID via `X-Request-ID` (`plugins/request-id.ts`)
- [x] **URL-based API versioning** — all routes under `/v1` prefix
- [ ] **Restrict CORS origins** — currently `origin: true` (allows all); must whitelist production domains and deep link schemes only
- [ ] **Add security headers** — install `@fastify/helmet` for `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Content-Security-Policy`
- [ ] **Validate all route params with Zod** — some `:id` params are still parsed via `request.params as { id: string }` without UUID validation
- [ ] **Add request body size limit** — Fastify defaults to 1 MB; confirm this is appropriate and add explicit `bodyLimit` for webhook routes

## 4. Secrets Management

- [x] **Zod-validated environment config** — app exits on startup if any required secret is missing (`config/env.ts`)
- [x] **TOKEN_ENCRYPTION_KEY min 32 chars** enforced by Zod schema
- [x] **`.env` files gitignored** — only `.env.example` committed (contains placeholders only)
- [x] **Separate `.env.example`** for API and mobile (mobile only has public keys)
- [ ] **Use a secrets manager in production** — don't rely on plain `.env` files on servers; use platform-native secrets (e.g. Railway/Render secrets, AWS SSM, Doppler)
- [ ] **Rotate secrets on compromise** — document procedure: revoke Supabase keys, rotate `TOKEN_ENCRYPTION_KEY` (re-encrypt all stored tokens), rotate TrueLayer client secret
- [ ] **Never log secrets** — audit all `console.log` / `app.log` calls to ensure no token, key, or credential values are printed

## 5. Least Privilege Access

- [x] **Ownership checks on all resource routes** — budgets, transactions, insights, notifications, connections all filter by `request.userId`
- [x] **Read-only open banking** — TrueLayer AIS (Account Information Services) only; no payment initiation
- [x] **Supabase service key server-side only** — mobile app uses anon key; service key never leaves the API server
- [ ] **Database role separation** — API should connect with a role that cannot `DROP TABLE` or modify schema; migrations use a separate elevated role
- [ ] **Redis ACL** — restrict the BullMQ Redis connection to only the queues it needs

## 6. Financial Data Protection

- [x] **Bank tokens encrypted at rest** with AES-256-GCM
- [x] **Transactions stored locally** — never re-fetched per API call; synced via background jobs
- [x] **Decimal(12,2) for all monetary values** — no floating-point errors
- [x] **Soft delete for users** — `deletedAt` field preserves audit trail, actual data purge deferred
- [x] **Soft delete for accounts** — `isActive` flag keeps transaction history when bank disconnected
- [ ] **Data retention policy** — define how long transaction data is kept after account deletion (GDPR: "without undue delay", typically 30 days)
- [ ] **Export endpoint** — users must be able to download all their data (GDPR Article 15)
- [ ] **Hard delete pipeline** — scheduled job to permanently purge user data 30 days after soft delete
- [ ] **Mask account numbers** in API responses — only show last 4 digits of IBAN
- [ ] **No financial data in logs** — confirm transaction amounts, balances, and merchant names are never logged

## 7. Audit Logging

- [x] **AuditLog model** in database — userId, action, entityType, entityId, metadata, ipAddress, timestamp
- [x] **Logged actions:** `BANK_CONNECTED`, `BANK_DISCONNECTED`, `ACCOUNT_DELETED`, `CONSENT_EXPIRED`
- [ ] **Expand coverage** — add audit logs for:
  - User profile updates
  - Budget create/update/delete
  - Transaction category overrides
  - Manual sync triggers
  - Failed authentication attempts
  - Notification settings changes
- [ ] **Include IP address** — capture `request.ip` in audit log entries
- [ ] **Immutable audit store** — audit_logs table should not allow UPDATE or DELETE from the API database role
- [ ] **Retention period** — keep audit logs for minimum 12 months

## 8. Webhook Verification

- [x] **HMAC-SHA512 signature verification** on TrueLayer webhooks (`routes/webhooks.ts`)
- [x] **`crypto.timingSafeEqual()`** — prevents timing-based signature attacks (`services/truelayer.ts`)
- [x] **Raw body preserved** for signature computation (custom Fastify content-type parser)
- [x] **Immediate 200 + async processing** — webhook payload enqueued to BullMQ, processed by worker
- [x] **401 on missing or invalid signature** with warning logs
- [ ] **Replay protection** — check webhook timestamp and reject events older than 5 minutes
- [ ] **Idempotency** — ensure webhook events are processed only once (use event ID as deduplication key in BullMQ)

## 9. Rate Limiting

- [x] **Per-user rate limiter** — 100 requests/minute with proper `X-RateLimit-*` headers (`plugins/rate-limit.ts`)
- [x] **Falls back to IP** for unauthenticated routes
- [x] **Health check routes excluded** from rate limiting
- [x] **Error handler maps 429** to standardised error response
- [ ] **Migrate to Redis-backed limiter** before horizontal scaling — current in-memory store is per-instance only
- [ ] **Tiered limits** — lower limit for auth endpoints (e.g. 10/min for `/auth/register`) to prevent abuse
- [ ] **Sync trigger limit** — max 1 manual sync per account per 5 minutes to prevent API abuse against TrueLayer

## 10. Fraud & Abuse Considerations

- [x] **OAuth state parameter** generated per connection request (CSRF protection for bank linking)
- [x] **Consent expiry handling** — EXPIRED/REVOKED connections blocked from syncing
- [ ] **Validate OAuth state strictly** — current callback matches ANY pending connection; must store `state → userId` in Redis with 10-minute TTL and verify exact match
- [ ] **Account linking limits** — cap at e.g. 10 connected institutions per user to prevent enumeration
- [ ] **Unusual activity detection** — flag accounts with abnormally high sync requests or connection churn
- [ ] **Bot protection** — add CAPTCHA or proof-of-work for registration if abuse detected
- [ ] **Email verification** — Supabase magic link implicitly verifies email, but confirm this is enforced

## 11. Secure Mobile Storage

- [x] **`expo-secure-store`** for Supabase session tokens — uses iOS Keychain / Android Keystore (`lib/supabase.ts`)
- [x] **No `AsyncStorage`** or `localStorage` for sensitive data
- [x] **`detectSessionInUrl: false`** — prevents deep link token interception
- [x] **`persistSession: true`** — sessions survive app restart via secure storage
- [ ] **Certificate pinning** — pin the API server and Supabase TLS certificates to prevent MITM
- [ ] **Jailbreak/root detection** — warn users on compromised devices (optional, informational only)
- [ ] **Screen capture protection** — disable screenshots on sensitive screens (balance, transactions) on Android via `FLAG_SECURE`
- [ ] **Background snapshot protection** — blur app content in task switcher

## 12. Privacy & Consent Handling

- [x] **Read-only data access** — app never initiates payments or modifies bank data
- [x] **PSD2 consent model** — 90-day consent window with re-auth nudge
- [x] **Consent expiry notifications** — user notified when bank connection needs renewal
- [x] **Bank disconnect flow** — user can revoke access; accounts deactivated, history preserved
- [x] **Account deletion flow** — soft delete with audit log
- [ ] **Privacy policy** — must be displayed during onboarding and accessible from settings
- [ ] **Consent language** — explain in plain English exactly what data is accessed (account names, balances, transactions) and that we never access login credentials
- [ ] **Data processing agreement** — document TrueLayer as a data processor
- [ ] **GDPR Article 17 (right to erasure)** — hard delete pipeline must purge all personal data within 30 days of request
- [ ] **GDPR Article 20 (data portability)** — CSV/JSON export of all user data
- [ ] **Cookie/tracking disclosure** — if analytics are added later, update privacy notice
- [ ] **Under-18 check** — add age gate or terms acceptance during onboarding

## 13. Incident Response Basics

- [ ] **Document an incident runbook** — who to contact, how to revoke TrueLayer API access, how to rotate keys
- [ ] **Supabase key revocation** — know how to invalidate all sessions (regenerate JWT secret)
- [ ] **TrueLayer token revocation** — API call to revoke all user consents if breach suspected
- [ ] **User notification template** — pre-draft breach notification email (GDPR: 72-hour disclosure)
- [ ] **Database backup verification** — confirm automated backups exist and test restore procedure
- [ ] **Logging for forensics** — ensure all audit logs, request logs, and worker logs are persisted (not just stdout) and retained for investigation

---

## Priority Summary

### Must-fix before production launch

| # | Item | Effort |
|---|------|--------|
| 1 | Restrict CORS to production origins | 5 min |
| 2 | Fix OAuth state validation (Redis lookup) | 2 hrs |
| 3 | Add `@fastify/helmet` security headers | 15 min |
| 4 | Enforce TLS / HTTPS redirect | 30 min |
| 5 | Privacy policy page | 2 hrs |
| 6 | Validate all route `:id` params with Zod UUID | 1 hr |

### Should-fix before scaling

| # | Item | Effort |
|---|------|--------|
| 7 | Redis-backed rate limiting | 2 hrs |
| 8 | Expand audit log coverage | 3 hrs |
| 9 | Hard delete / data purge pipeline | 4 hrs |
| 10 | Data export endpoint (GDPR) | 3 hrs |
| 11 | Tiered rate limits for auth endpoints | 1 hr |
| 12 | Incident response runbook | 2 hrs |

### Nice-to-have for hardening

| # | Item | Effort |
|---|------|--------|
| 13 | Certificate pinning on mobile | 2 hrs |
| 14 | Encryption key rotation | 4 hrs |
| 15 | MFA/2FA via Supabase | 2 hrs |
| 16 | Webhook replay protection | 1 hr |
| 17 | Screen capture / task switcher protection | 1 hr |
