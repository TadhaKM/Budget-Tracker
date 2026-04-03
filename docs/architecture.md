# ClearMoney — Technical Architecture

## 1. Architecture Overview

ClearMoney follows a **three-tier architecture** with a clear separation between the mobile client, a stateless API layer, and a persistence layer backed by PostgreSQL and Redis. Bank data flows through a **one-way sync pipeline** — the app never writes to bank accounts, only reads.

The system is designed around five principles:

1. **Read-only financial data** — we aggregate, we never transact
2. **Encrypt everything sensitive at rest and in transit**
3. **Sync in the background** — never block the user waiting for bank data
4. **Compute once, serve fast** — pre-aggregate analytics, don't compute per request
5. **Fail gracefully** — stale data with a timestamp is better than an error screen

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                            │
│           React Native / Expo (iOS + Android)                   │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Dashboard │ │  Txn     │ │ Budgets  │ │  Subs    │          │
│  │  Screen  │ │  Feed    │ │  Screen  │ │  Screen  │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       └─────────────┴────────────┴─────────────┘               │
│                         │                                       │
│              TanStack Query (cache + fetch)                     │
│              Zustand (local UI state)                           │
│              Supabase Auth (session / tokens)                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (TLS 1.3)
                          │ Bearer JWT
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                │
│              Node.js / Fastify (stateless)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Route Handlers                        │   │
│  │  /health  /auth  /accounts  /transactions  /budgets     │   │
│  │  /insights  /webhooks                                    │   │
│  └──────────┬──────────────────────┬───────────────────────┘   │
│             │                      │                            │
│  ┌──────────▼──────────┐ ┌────────▼─────────────────────┐     │
│  │   Prisma ORM        │ │   BullMQ (job dispatch)      │     │
│  │   (DB access)       │ │   (enqueue sync/notify jobs) │     │
│  └──────────┬──────────┘ └────────┬─────────────────────┘     │
└─────────────┼──────────────────────┼────────────────────────────┘
              │                      │
              ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────────────┐
│     PostgreSQL       │  │            Redis                      │
│                      │  │                                       │
│  users               │  │  BullMQ job queues                   │
│  connected_banks     │  │  Rate limit counters                 │
│  accounts            │  │  Webhook deduplication               │
│  transactions        │  │  Session cache (optional)            │
│  budgets             │  │                                       │
│  recurring_payments  │  └──────────────────┬───────────────────┘
│  analytics_cache     │                     │
└──────────────────────┘                     ▼
                          ┌──────────────────────────────────────┐
                          │         WORKER PROCESSES              │
                          │         (BullMQ consumers)            │
                          │                                       │
                          │  sync:account     — pull bank data   │
                          │  sync:webhook     — process webhooks │
                          │  detect:recurring — find patterns    │
                          │  compute:insights — weekly analytics │
                          │  notify:budget    — push alerts      │
                          │  notify:weekly    — Monday digest    │
                          └──────────┬───────────────────────────┘
                                     │
                                     ▼
                          ┌──────────────────────────────────────┐
                          │        TRUELAYER API                  │
                          │        (Open Banking Aggregator)      │
                          │                                       │
                          │  OAuth consent flow                   │
                          │  GET /data/v1/accounts                │
                          │  GET /data/v1/accounts/{id}/balance   │
                          │  GET /data/v1/accounts/{id}/txns      │
                          │  POST /connect/token (refresh)        │
                          │  Webhooks → our /webhooks/truelayer   │
                          └──────────────────────────────────────┘
```

---

## 2. Frontend Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React Native + Expo SDK 52 | Single codebase for iOS + Android. Expo manages the native build toolchain, so a solo dev doesn't need Xcode/Gradle expertise. |
| Navigation | Expo Router v4 | File-based routing. Tabs + stacks defined by directory structure. Typed routes via `experiments.typedRoutes`. |
| Styling | NativeWind v4 (Tailwind for RN) | Utility-first, consistent design tokens, fast iteration. Dark theme via custom `background`/`surface` color tokens. |
| Data fetching | TanStack Query v5 | Automatic caching, background refetch, stale-while-revalidate. 5-minute stale time means the app feels instant on re-open. |
| Client state | Zustand v5 | Minimal boilerplate for UI state (selected account, active filters). Not used for server-synced data — that's TanStack Query's job. |
| Auth | Supabase JS client + expo-secure-store | Magic link auth. Tokens stored in iOS Keychain / Android Keystore via expo-secure-store. Session auto-refreshes. |
| Charts | Victory Native / react-native-svg | Category donut chart, budget progress bars. Keep visualizations simple — no complex interactive charts in MVP. |
| Icons | @expo/vector-icons (MaterialIcons) | Consistent icon set that ships with Expo. No extra bundle size. |

### Frontend Architecture Patterns

```
src/
  app/                    ← Expo Router (file-based routes)
    _layout.tsx           ← Root: providers wrap the entire app
    (auth)/               ← Auth group: sign-in, magic link confirmation
    (tabs)/               ← Main app: 5 tab screens
    account/[id].tsx      ← Stack push for account detail
    transaction/[id].tsx  ← Modal for transaction detail

  providers/              ← React context providers
    QueryProvider.tsx     ← TanStack QueryClient configuration
    AuthProvider.tsx      ← Session listener + route guard

  hooks/                  ← Custom hooks (data fetching)
    useAccounts.ts        ← useQuery(['accounts']) → GET /accounts
    useTransactions.ts    ← useQuery(['transactions', filters])
    useBudgets.ts         ← useQuery(['budgets'])
    useInsights.ts        ← useQuery(['insights', 'weekly'])

  stores/                 ← Zustand stores (UI state only)
    accounts.ts           ← Selected account, account list cache
    transactions.ts       ← Active category filter
    budgets.ts            ← Budget list cache

  lib/                    ← Utilities
    api.ts                ← Fetch wrapper with auth headers
    supabase.ts           ← Supabase client with SecureStore adapter

  components/ui/          ← Reusable UI primitives
    Button.tsx
    Card.tsx
    ScreenContainer.tsx
```

**Key decisions:**

- **No Redux.** Zustand handles the small amount of client state. TanStack Query handles all server state. Adding Redux would be unnecessary complexity.
- **No Axios.** The native `fetch` API is sufficient. The `apiFetch` wrapper in `lib/api.ts` adds auth headers and base URL. No need for interceptors at this scale.
- **Expo Router over React Navigation directly.** File-based routing is simpler to reason about and Expo Router handles deep linking, typed routes, and layout nesting out of the box.

---

## 3. Backend Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 22+ | TypeScript-native with `tsx`, large ecosystem, async I/O fits the webhook/sync workload well. |
| Framework | Fastify v5 | 2–3x faster than Express. Built-in schema validation, plugin system, structured logging. Lightweight. |
| ORM | Prisma v6 | Type-safe database access. Migrations. Schema-as-code. Generated client ensures the app code matches the DB schema at compile time. |
| Auth | Supabase Auth (server-side validation) | API validates JWTs from Supabase. The `authenticate` preHandler calls `supabase.auth.getUser(token)` and decorates `request.userId`. |
| Job queue | BullMQ v5 | Redis-backed, battle-tested. Supports retries, backoff, concurrency control, scheduled jobs, and rate limiting. |
| Validation | Zod v3 | Shared between frontend and backend via `@clearmoney/shared`. Request bodies validated at the route level. |
| Aggregator | TrueLayer API | PSD2-compliant open banking. Best Irish bank coverage. OAuth flow + REST API + webhooks. |

### API Route Structure

```
POST   /auth/truelayer/link       → Generate TrueLayer consent URL
GET    /auth/truelayer/callback   → Exchange auth code, store tokens, trigger sync

GET    /accounts                  → List user's connected accounts
POST   /accounts/:id/sync        → Trigger manual re-sync

GET    /transactions              → Paginated, filterable transaction feed
PATCH  /transactions/:id/category → Re-categorise a transaction

GET    /budgets                   → List user's budgets
POST   /budgets                   → Create a budget
PATCH  /budgets/:id               → Update a budget
DELETE /budgets/:id               → Delete a budget

GET    /insights/weekly           → Current week's spending summary

POST   /webhooks/truelayer        → Receive TrueLayer webhook events

GET    /health                    → Liveness check
GET    /health/ready              → Readiness check (DB connectivity)
```

**Key decisions:**

- **Fastify plugins for cross-cutting concerns.** Auth and Prisma are registered as Fastify plugins, making them available to all routes via `app.authenticate` and `app.prisma`. No dependency injection framework needed.
- **Stateless API servers.** No sessions stored in memory. JWT validation + database queries. This means horizontal scaling is trivial — add more API instances behind a load balancer.
- **Separate worker processes.** API servers handle HTTP requests. Workers handle background jobs. They share the same codebase but run different entry points. This prevents a slow sync job from blocking API responses.

---

## 4. Database Design

### Why PostgreSQL

- Transactions and accounts are inherently relational (account has many transactions, user has many accounts)
- ACID compliance is critical for financial data — no eventual consistency for balances
- Decimal types (`NUMERIC(12,2)`) handle money correctly — no floating-point errors
- Excellent indexing for time-range queries (transaction history)
- Prisma has first-class PostgreSQL support

### Schema

```
┌──────────┐     ┌───────────────┐     ┌───────────┐
│  users   │────<│connected_banks│     │  budgets  │
│          │     │               │     │           │
│ id (PK)  │     │ id (PK)       │     │ id (PK)   │
│ email    │     │ user_id (FK)  │     │ user_id   │
│ created  │     │ provider_id   │     │ category  │
│          │     │ access_token* │     │ limit_amt │
│          │────<│ refresh_token*│     │ period    │
│          │     │ consent_exp   │     │           │
│          │     └───────────────┘     └───────────┘
│          │
│          │────<┌───────────┐
│          │     │ accounts  │────<┌──────────────┐
│          │     │           │     │ transactions │
│          │     │ id (PK)   │     │              │
│          │     │ user_id   │     │ id (PK)      │
│          │     │ tl_acct_id│     │ account_id   │
│          │     │ bank_name │     │ tl_txn_id    │
│          │     │ acct_type │     │ amount       │
│          │     │ balance   │     │ currency     │
│          │     │ currency  │     │ description  │
│          │     │ last_sync │     │ merchant     │
│          │     └───────────┘     │ category     │
│          │                       │ timestamp    │
│          │                       └──────────────┘
│          │
│          │────<┌────────────────────┐
│          │     │ recurring_payments │
│          │     │                    │
│          │     │ id (PK)            │
│          │     │ user_id (FK)       │
│          │     │ merchant_name      │
│          │     │ amount             │
│          │     │ frequency          │
│          │     │ last_seen          │
│          │     │ category           │
│          │     └────────────────────┘
└──────────┘

* = encrypted at rest (AES-256-GCM)
```

### Key Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `transactions` | `(account_id, timestamp DESC)` | Feed queries: "latest transactions for this account" |
| `transactions` | `(category)` | Filter by category |
| `transactions` | `(truelayer_transaction_id) UNIQUE` | Deduplication on sync |
| `accounts` | `(truelayer_account_id) UNIQUE` | Prevent duplicate account connections |
| `budgets` | `(user_id, category) UNIQUE` | One budget per category per user |
| `recurring_payments` | `(user_id, merchant_name) UNIQUE` | One entry per recurring merchant per user |

### Data Volumes (Estimated per user)

| Entity | Est. rows per user | Growth rate |
|--------|-------------------|-------------|
| Accounts | 1–3 | Static |
| Transactions | ~1,500/year (30/week) | ~30/week |
| Budgets | 3–8 | Static |
| Recurring payments | 5–15 | ~1/month |

At 10,000 users, expect ~15M transaction rows. PostgreSQL handles this comfortably with proper indexes and partitioning is not needed at this scale.

---

## 5. Job Queue / Worker Design

### Queue Architecture

```
                    ┌─────────────────────────┐
                    │          Redis           │
                    │                          │
                    │  Queue: sync:account     │
                    │  Queue: sync:webhook     │
                    │  Queue: detect:recurring │
                    │  Queue: compute:insights │
                    │  Queue: notify:budget    │
                    │  Queue: notify:weekly    │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────────┐ ┌──────────┐ ┌──────────────────┐
     │ Sync Workers   │ │ Compute  │ │ Notify Workers   │
     │ (concurrency 5)│ │ Workers  │ │ (concurrency 3)  │
     │                │ │ (conc 2) │ │                   │
     │ sync:account   │ │ detect:  │ │ notify:budget    │
     │ sync:webhook   │ │ recurring│ │ notify:weekly    │
     │                │ │ compute: │ │                   │
     │                │ │ insights │ │                   │
     └────────────────┘ └──────────┘ └──────────────────┘
```

### Job Definitions

| Queue | Trigger | What it does | Retry policy |
|-------|---------|-------------|--------------|
| `sync:account` | Account connection, manual refresh, scheduled (every 6 hours) | Fetches accounts + transactions from TrueLayer. Upserts into DB. Updates balances. | 3 retries, exponential backoff (5s, 25s, 125s) |
| `sync:webhook` | TrueLayer webhook POST | Parses webhook payload. Identifies affected account. Runs delta sync (new transactions only). | 3 retries, 5s backoff |
| `detect:recurring` | Nightly cron (02:00 UTC) | Scans each user's transactions for recurring patterns. Upserts `recurring_payments` table. | 2 retries |
| `compute:insights` | Monday 07:00 UTC | Computes weekly spending summary per user. Caches result in `analytics_cache` table. | 2 retries |
| `notify:budget` | After every `sync:account` completes | Checks if any budget threshold (80%, 100%) was crossed. Sends push notification if so. | 1 retry |
| `notify:weekly` | Monday 08:00 UTC (after compute:insights) | Sends weekly digest push notification with pre-computed insight data. | 1 retry |

### Job Scheduling

```typescript
// Scheduled jobs (registered on API startup or in a dedicated scheduler process)

// Sync all accounts every 6 hours
syncAccountQueue.upsertJobScheduler('sync-all-accounts', {
  pattern: '0 */6 * * *',  // every 6 hours
});

// Nightly recurring detection
detectRecurringQueue.upsertJobScheduler('nightly-detection', {
  pattern: '0 2 * * *',    // 02:00 UTC daily
});

// Weekly insight computation
computeInsightsQueue.upsertJobScheduler('weekly-insights', {
  pattern: '0 7 * * 1',    // Monday 07:00 UTC
});

// Weekly notification (runs after insights are computed)
notifyWeeklyQueue.upsertJobScheduler('weekly-digest', {
  pattern: '0 8 * * 1',    // Monday 08:00 UTC
});
```

### Worker Isolation

Workers run as separate processes from the API server. In production:

```
Process 1: API server (fastify, HTTP handling)
Process 2: Sync workers (sync:account, sync:webhook)
Process 3: Compute workers (detect:recurring, compute:insights)
Process 4: Notify workers (notify:budget, notify:weekly)
```

This prevents a slow TrueLayer API response from affecting API latency, and prevents a notification failure from blocking syncs.

---

## 6. Sync Pipeline Design

### Initial Sync (on account connection)

```
User taps "Connect Bank"
        │
        ▼
┌───────────────────┐
│ App opens TrueLayer│
│ OAuth consent flow │
│ (in-app browser)   │
└────────┬──────────┘
         │ User approves
         ▼
┌───────────────────┐
│ TrueLayer callback│
│ → API receives    │
│   authorization   │
│   code            │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐     ┌──────────────────────┐
│ Exchange code for │────>│ Encrypt tokens with   │
│ access + refresh  │     │ AES-256-GCM           │
│ tokens            │     │ Store in connected_   │
└────────┬──────────┘     │ banks table           │
         │                └──────────────────────┘
         ▼
┌───────────────────┐
│ Enqueue job:      │
│ sync:account      │
│ { userId,         │
│   initialSync:    │
│   true }          │
└────────┬──────────┘
         │ (async, user sees "Syncing..." in app)
         ▼
┌───────────────────────────────────────────────┐
│              sync:account worker               │
│                                                │
│  1. Decrypt access token                       │
│  2. GET /data/v1/accounts                      │
│     → Upsert accounts table                   │
│  3. For each account:                          │
│     GET /data/v1/accounts/{id}/balance         │
│     → Update account balance                   │
│  4. For each account:                          │
│     GET /data/v1/accounts/{id}/transactions    │
│     ?from=90_days_ago                          │
│     → Categorise each transaction              │
│     → Upsert transactions (dedup on tl_txn_id)│
│  5. Update account.last_synced timestamp       │
│  6. Enqueue notify:budget (check thresholds)   │
└───────────────────────────────────────────────┘
```

### Ongoing Sync (webhook-driven)

```
TrueLayer detects new transactions
        │
        ▼
POST /webhooks/truelayer
        │
        ▼
┌───────────────────┐
│ Verify webhook    │
│ signature         │
│ (HMAC-SHA512)     │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Deduplicate       │
│ (Redis SET NX     │
│  webhook_id,      │
│  TTL 24h)         │
└────────┬──────────┘
         │ (if not duplicate)
         ▼
┌───────────────────┐
│ Enqueue job:      │
│ sync:webhook      │
│ { webhookPayload }│
└────────┬──────────┘
         │
         ▼
┌───────────────────────────────────────────────┐
│            sync:webhook worker                 │
│                                                │
│  1. Parse webhook → identify account + user    │
│  2. Decrypt access token                       │
│  3. GET /data/v1/accounts/{id}/transactions    │
│     ?from=last_synced                          │
│  4. Categorise + upsert new transactions only  │
│  5. Update balance                             │
│  6. Update last_synced                         │
│  7. Enqueue notify:budget                      │
└───────────────────────────────────────────────┘
```

### Token Refresh Flow

```
Any sync worker, before calling TrueLayer:
        │
        ▼
┌───────────────────┐
│ Check: is access  │──── Yes ──── Proceed with API call
│ token expired?    │
└────────┬──────────┘
         │ Yes (expired)
         ▼
┌───────────────────┐
│ Decrypt refresh   │
│ token             │
│ POST /connect/    │
│ token             │
│ grant_type=       │
│ refresh_token     │
└────────┬──────────┘
         │
    ┌────┴────┐
    │         │
 Success    Failed
    │         │
    ▼         ▼
┌────────┐ ┌─────────────────────┐
│ Encrypt│ │ Mark bank as        │
│ + store│ │ "needs re-auth"     │
│ new    │ │ Push notification:  │
│ tokens │ │ "Reconnect your     │
└────────┘ │  bank account"      │
           └─────────────────────┘
```

### Categorisation Pipeline

```
Raw transaction from TrueLayer
        │
        ▼
┌───────────────────┐
│ Step 1: Check     │──── Hit ──── Use stored category
│ user override     │              (merchant_overrides table)
│ table             │
└────────┬──────────┘
         │ Miss
         ▼
┌───────────────────┐
│ Step 2: Check     │──── Hit ──── Use rule category
│ merchant rules    │
│ (curated table)   │
└────────┬──────────┘
         │ Miss
         ▼
┌───────────────────┐
│ Step 3: Use       │──── Has category ──── Map to our
│ TrueLayer's       │                       12 categories
│ category field    │
└────────┬──────────┘
         │ No category
         ▼
┌───────────────────┐
│ Step 4: Default   │
│ to "OTHER"        │
└───────────────────┘
```

---

## 7. Security Considerations

### Data Classification

| Data | Classification | Handling |
|------|---------------|----------|
| TrueLayer access/refresh tokens | **Critical** | AES-256-GCM encrypted at rest. Encryption key in environment variable / secrets manager. Never logged. Never returned to client. |
| Transaction data | **Sensitive** | Stored in PostgreSQL. Accessible only to the owning user (enforced at query level via `userId`). |
| User email | **PII** | Stored in Supabase Auth + our users table. Subject to GDPR right-to-erasure. |
| Account balances | **Sensitive** | Same as transaction data. |
| JWT tokens (Supabase) | **Authentication** | Stored on device via expo-secure-store (iOS Keychain / Android Keystore). Short-lived (1 hour), auto-refreshed. |
| Webhook payloads | **Sensitive** | Verified via HMAC signature. Processed immediately. Not stored raw. |

### Encryption Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Token Encryption                     │
│                                                      │
│  Plaintext token                                     │
│       │                                              │
│       ▼                                              │
│  ┌──────────────────────────┐                       │
│  │ AES-256-GCM encrypt      │                       │
│  │ Key: TOKEN_ENCRYPTION_KEY│ (env var, 32 bytes)   │
│  │ IV: random 12 bytes      │ (per encryption)      │
│  │ Output: iv + ciphertext  │ + auth tag            │
│  └──────────────────────────┘                       │
│       │                                              │
│       ▼                                              │
│  Store as single base64 blob in connected_banks     │
│  Column: truelayer_access_token_encrypted           │
└─────────────────────────────────────────────────────┘
```

### Access Control

| Layer | Mechanism |
|-------|-----------|
| Mobile → API | Supabase JWT in `Authorization: Bearer` header. Validated on every request via `authenticate` preHandler. |
| API → Database | All queries scoped to `request.userId`. No query ever fetches data without a `WHERE user_id = ?` clause. |
| API → TrueLayer | Per-user access tokens. Decrypted only at the moment of use, held in memory briefly, never logged. |
| Webhooks | HMAC-SHA512 signature verification. Reject unsigned or mis-signed payloads. |

### OWASP Mitigations

| Threat | Mitigation |
|--------|-----------|
| SQL Injection | Prisma ORM — parameterized queries. No raw SQL in application code. |
| XSS | Not applicable (native mobile, no web views rendering user HTML). |
| Broken Authentication | Supabase handles password hashing, token rotation, rate limiting on auth endpoints. |
| Sensitive Data Exposure | Tokens encrypted at rest. All API responses strip internal IDs. HTTPS-only. |
| Mass Assignment | Zod schemas validate all request bodies. Only whitelisted fields accepted. |
| IDOR | Every database query filters by `userId` from the JWT — not from URL params. |
| Rate Limiting | Fastify rate limiter on auth endpoints (10 req/min). TrueLayer sync jobs respect API rate limits via BullMQ rate limiter. |

### GDPR Compliance

| Requirement | Implementation |
|-------------|---------------|
| Right to access | CSV export from Settings (GET /export endpoint) |
| Right to erasure | Account deletion cascade: user → connected_banks → accounts → transactions → budgets → recurring_payments. Supabase user also deleted. Completed within 48 hours. |
| Data minimization | We only store transaction data needed for categorisation and display. No raw bank statements. |
| Data processor agreement | Required with TrueLayer (they are a data processor under PSD2). |
| Privacy policy | Required before App Store submission. Must disclose: data collected, purpose, retention, third parties (TrueLayer). |

---

## 8. Deployment Architecture

### Target: Railway (MVP) → AWS/GCP (Scale)

```
┌─────────────────────────────────────────────────────────────┐
│                       Railway.app                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  API Service  │  │ Sync Worker  │  │ Notify Worker│      │
│  │  (Fastify)    │  │ (BullMQ)     │  │ (BullMQ)     │      │
│  │  Port 3001    │  │              │  │              │      │
│  │  2 instances  │  │  1 instance  │  │  1 instance  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┼──────────────────┘               │
│                           │                                  │
│                           ▼                                  │
│         ┌─────────────────────────────────┐                 │
│         │  PostgreSQL (managed, Railway)  │                 │
│         │  Daily automated backups        │                 │
│         │  Point-in-time recovery         │                 │
│         └─────────────────────────────────┘                 │
│                                                              │
│         ┌─────────────────────────────────┐                 │
│         │  Redis (managed, Railway)       │                 │
│         │  Persistence: AOF              │                 │
│         └─────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────┐      ┌─────────────────────────┐
│  Supabase (managed)     │      │  Expo EAS Build         │
│  Auth + JWT signing     │      │  iOS + Android builds   │
│  Magic link emails      │      │  OTA updates            │
└─────────────────────────┘      └─────────────────────────┘
```

### Environment Strategy

| Environment | Purpose | Database |
|-------------|---------|----------|
| `development` | Local dev. `turbo dev` runs everything. | Local PostgreSQL + Redis (Docker Compose) |
| `staging` | Pre-release testing. Connected to TrueLayer sandbox. | Railway staging project |
| `production` | Live app. Connected to TrueLayer live. | Railway production project |

### CI/CD Pipeline

```
Push to main
      │
      ▼
┌─────────────────┐
│ GitHub Actions   │
│                  │
│ 1. Install deps  │
│ 2. Lint          │
│ 3. Type check    │
│ 4. Run tests     │
│ 5. Build         │
└────────┬────────┘
         │ (all green)
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Railway auto-   │     │ EAS Build       │
│ deploys API +   │     │ (triggered      │
│ workers from    │     │  manually or    │
│ main branch     │     │  on release tag)│
└─────────────────┘     └─────────────────┘
```

### Docker Compose (local dev)

```yaml
# docker-compose.yml (for local PostgreSQL + Redis only)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: clearmoney
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

---

## 9. Logging and Monitoring Plan

### Logging Strategy

| Layer | Tool | What we log |
|-------|------|-------------|
| API | Fastify built-in logger (pino) | Request/response (method, path, status, latency). Structured JSON. |
| Workers | Pino (same as Fastify) | Job start, completion, failure. Queue name, job ID, duration. |
| Errors | Sentry | Unhandled exceptions, promise rejections. Stack traces with source maps. |
| Business events | Custom structured logs | Account connected, sync completed, budget alert triggered, consent expiring. |

### What we NEVER log

- Access tokens or refresh tokens
- Full transaction descriptions (may contain sensitive info)
- User emails in request logs
- Encryption keys
- Webhook payloads (may contain bank data)

### Monitoring Stack

```
┌────────────────────────────────────────────────────────┐
│                    Monitoring                           │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │  Sentry   │  │ PostHog  │  │ BullMQ Dashboard     │ │
│  │           │  │          │  │ (Bull Board)          │ │
│  │ Errors    │  │ Product  │  │                       │ │
│  │ Crashes   │  │ analytics│  │ Queue depth           │ │
│  │ Perf      │  │ Funnels  │  │ Job success/fail rate │ │
│  │           │  │ Retention│  │ Processing time       │ │
│  └──────────┘  └──────────┘  └──────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Railway Metrics (built-in)                       │  │
│  │  CPU, memory, network, request count, latency    │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Key Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| API error rate spike | >5% of requests returning 5xx in 5 minutes | Page on-call (PagerDuty/email) |
| Sync queue depth | >100 pending jobs for >15 minutes | Investigate TrueLayer rate limits or worker crash |
| Failed sync jobs | >10 failures in 1 hour | Check TrueLayer status, token expiry |
| Database connection pool exhaustion | Available connections < 2 | Scale up or investigate connection leak |
| Consent expiring | Consent expires within 7 days | Trigger in-app re-auth nudge (automated) |
| Zero syncs for a user | No successful sync in 24 hours for active user | Check if consent expired silently |

### Health Check Endpoints

```
GET /health       → { "status": "ok", "timestamp": "..." }
                    Returns 200 if server is running.

GET /health/ready → { "status": "ready" }
                    Returns 200 if DB is reachable.
                    Returns 503 if DB connection fails.
                    Used by load balancer for routing decisions.
```

---

## 10. Scalability Considerations

### Current Design Limits (MVP target: 10,000 users)

| Component | Limit | When to worry |
|-----------|-------|---------------|
| PostgreSQL (single instance) | ~100M transaction rows | ~50,000 active users |
| Redis (single instance) | ~100k pending jobs | Not a concern at MVP scale |
| API server (2 instances) | ~500 concurrent requests | ~10,000 daily active users |
| BullMQ workers | ~50 jobs/second per worker | ~20,000 accounts syncing |
| TrueLayer API | Rate limits per client (varies) | ~5,000 connected accounts syncing simultaneously |

### Scaling Strategy by Phase

#### Phase 1: MVP (0–10,000 users)
- Single PostgreSQL instance (Railway managed)
- Single Redis instance
- 2 API server instances (Railway auto-scaling)
- 1–2 worker instances
- **Total cost: ~$30–50/month on Railway**

#### Phase 2: Growth (10,000–100,000 users)
- PostgreSQL read replicas for analytics queries
- Table partitioning on `transactions` by month
- Connection pooling (PgBouncer)
- 3–5 API instances
- Dedicated worker instances per queue type
- Move to AWS RDS / Cloud SQL for better backup and scaling options

#### Phase 3: Scale (100,000+ users)
- Horizontal PostgreSQL sharding (by user_id) or move analytics to a columnar store (ClickHouse/TimescaleDB)
- Redis Cluster for queue scaling
- API gateway (Kong/AWS ALB) with rate limiting
- CDN for any static assets
- Multi-region deployment if expanding beyond Ireland

### Performance Optimizations (Built into MVP)

| Optimization | Implementation |
|-------------|---------------|
| Cursor-based pagination | Transaction feed uses cursor, not offset. O(1) regardless of page depth. |
| Pre-computed analytics | Weekly insights computed by background job, stored in cache table. API serves cached result, not live computation. |
| Database indexes | Composite indexes on (account_id, timestamp) and (category) for the two most common query patterns. |
| Connection pooling | Prisma manages connection pool. Default pool size = 10 connections. |
| Query scoping | Every query includes `WHERE user_id = ?` first, hitting the primary key index before any secondary filters. |
| Stale-while-revalidate | TanStack Query serves cached data instantly while refetching in the background. User never waits for fresh data. |

### What We Explicitly Defer

| Optimization | Why we skip it for now |
|-------------|----------------------|
| Database partitioning | Under 100M rows, single-table performance is fine with proper indexes |
| Materialized views | Pre-computed cache table in the application layer is simpler and sufficient |
| GraphQL | REST is simpler, fewer moving parts, no query complexity attacks to worry about |
| Microservices | Monorepo with separate processes (API vs workers) gives us the isolation we need without the operational overhead of service mesh, distributed tracing, etc. |
| Event sourcing | Transactions are immutable once synced. Standard CRUD with an append-mostly pattern is sufficient. |
| Redis caching layer | At MVP scale, PostgreSQL with proper indexes handles all read patterns in <50ms. Adding a cache layer adds complexity for negligible gain. |

---

## Architecture Decision Records (ADRs)

### ADR-001: TrueLayer over Nordigen

**Decision:** Use TrueLayer as the primary open banking aggregator.

**Context:** Both TrueLayer and Nordigen (GoCardless) offer PSD2-compliant bank connections. Nordigen has a free tier. TrueLayer charges per connection.

**Rationale:**
- TrueLayer has better Irish bank coverage (AIB, BOI, PTSB confirmed working)
- TrueLayer provides built-in transaction categorisation
- TrueLayer offers webhook support for real-time sync
- TrueLayer sandbox is more realistic for development
- Developer experience (docs, SDKs, support) is significantly better

**Trade-off:** Higher cost per connection. Acceptable for MVP; can add Nordigen as a fallback at scale.

### ADR-002: Monorepo over Polyrepo

**Decision:** Use a Turborepo monorepo with npm workspaces.

**Context:** The system has three packages: mobile app, API server, shared types/schemas.

**Rationale:**
- Shared Zod schemas between frontend and backend prevent type drift
- Single `npm install` for all packages
- `turbo dev` runs everything in one command
- Atomic commits across packages when a schema change affects both API and mobile
- Solo developer — polyrepo adds operational overhead with no team-scaling benefit

### ADR-003: Separate Worker Processes

**Decision:** Run BullMQ workers as separate processes, not inline with the API server.

**Context:** Background jobs (sync, notifications) could run in the same process as the API server or as separate processes.

**Rationale:**
- A slow TrueLayer API response (3–5 seconds) would not block HTTP request handling
- Worker crashes don't take down the API
- Workers and API can scale independently (more workers during bulk sync, more API instances during peak usage)
- In development, both run via `turbo dev` — no extra complexity

### ADR-004: Supabase Auth over Custom Auth

**Decision:** Use Supabase Auth for user authentication.

**Context:** Could build custom auth (bcrypt + JWT) or use a managed service.

**Rationale:**
- Magic link auth is built-in — no email infrastructure to manage
- Apple and Google sign-in are pre-built
- JWT issuance, refresh, and revocation handled automatically
- Rate limiting on auth endpoints included
- Supabase free tier covers MVP scale (50,000 monthly active users)
- Avoids storing password hashes (reduces security surface area)

### ADR-005: Store Transactions Locally

**Decision:** Sync transactions into our PostgreSQL database rather than fetching from TrueLayer on every API request.

**Context:** Could proxy transaction reads through TrueLayer's API.

**Rationale:**
- TrueLayer rate limits would bottleneck read-heavy operations (dashboard loads)
- Offline/cached data requires local storage
- Analytics, categorisation, and recurring detection all need to query transactions — much faster against local PostgreSQL
- Consent expiry (90 days) would make the app non-functional if we relied on live API calls
- Deduplication logic is simpler when we own the data
