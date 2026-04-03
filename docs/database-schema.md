# ClearMoney — Production PostgreSQL Schema

## Schema Overview

17 tables organized into 5 domains:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           IDENTITY                                      │
│                                                                         │
│  ┌──────────┐                                                          │
│  │  users   │                                                          │
│  └────┬─────┘                                                          │
│       │                                                                 │
├───────┼─────────────────────────────────────────────────────────────────┤
│       │              BANKING                                            │
│       │                                                                 │
│  ┌────▼──────────┐    ┌────────────┐    ┌──────────────┐              │
│  │  institutions │───>│  accounts  │───>│ transactions │              │
│  │  (banks)      │    │            │    │              │              │
│  └───────────────┘    └────────────┘    └──────┬───────┘              │
│                                                │                       │
├────────────────────────────────────────────────┼───────────────────────┤
│                  CATEGORISATION                 │                       │
│                                                │                       │
│  ┌────────────┐    ┌───────────────┐    ┌─────▼────────────────┐     │
│  │ categories │───>│   merchants   │───>│ merchant_overrides   │     │
│  └────────────┘    └───────────────┘    └──────────────────────┘     │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│                    ANALYTICS                                          │
│                                                                       │
│  ┌────────────────────┐  ┌──────────────────┐  ┌──────────────┐     │
│  │ recurring_payments │  │ weekly_summaries  │  │   insights   │     │
│  └────────────────────┘  └──────────────────┘  └──────────────┘     │
│                                                                       │
│  ┌────────────┐  ┌────────────────────┐                              │
│  │  budgets   │  │  budget_snapshots  │                              │
│  └────────────┘  └────────────────────┘                              │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│                  OPERATIONS                                           │
│                                                                       │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────────┐           │
│  │  sync_jobs  │  │  notifications  │  │  audit_logs    │           │
│  └─────────────┘  └─────────────────┘  └────────────────┘           │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 1. Table Definitions

### Domain 1: Identity

#### `users`

The root entity. Every row in every other table traces back here.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | Never exposed to aggregator APIs |
| `email` | `TEXT` | UNIQUE, NOT NULL | From Supabase Auth — this is the canonical email |
| `supabase_id` | `TEXT` | UNIQUE, NOT NULL | Supabase Auth user ID. Used for JWT → user lookup. |
| `display_name` | `TEXT` | NULL | Optional. Used in weekly digest notifications. |
| `timezone` | `TEXT` | NOT NULL, DEFAULT 'Europe/Dublin' | For computing "this week" boundaries correctly |
| `currency` | `TEXT` | NOT NULL, DEFAULT 'EUR' | Primary display currency |
| `onboarded_at` | `TIMESTAMPTZ` | NULL | Set when user completes first bank connection |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Trigger-maintained |
| `deleted_at` | `TIMESTAMPTZ` | NULL | Soft delete for GDPR grace period |

**Why `supabase_id` separate from `id`?** Our internal UUID is the FK target everywhere. Supabase's ID is an external identifier used only at the auth boundary. This decouples our data model from the auth provider — if we migrate from Supabase, we change one lookup, not every FK.

---

### Domain 2: Banking

#### `institutions`

Represents a bank or financial institution available through TrueLayer.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `TEXT` | PK | TrueLayer provider ID, e.g. `ie-ob-aib`. Not a UUID — we use the aggregator's natural key. |
| `name` | `TEXT` | NOT NULL | Display name: "AIB", "Bank of Ireland" |
| `country` | `TEXT` | NOT NULL, DEFAULT 'IE' | ISO 3166-1 alpha-2 |
| `logo_url` | `TEXT` | NULL | CDN URL for bank logo |
| `is_available` | `BOOLEAN` | NOT NULL, DEFAULT true | Can be toggled off if a provider has issues |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Why a separate table?** Because multiple users connect to the same bank. Storing provider metadata per-connection is wasteful. This also lets us show a "Pick your bank" screen seeded from this table.

#### `connected_institutions`

A user's active connection to a bank. Holds encrypted OAuth tokens.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | |
| `institution_id` | `TEXT` | FK → institutions, NOT NULL | |
| `access_token_enc` | `TEXT` | NOT NULL | AES-256-GCM encrypted. Never logged, never in API responses. |
| `refresh_token_enc` | `TEXT` | NOT NULL | Same encryption. |
| `consent_granted_at` | `TIMESTAMPTZ` | NOT NULL | When user approved the consent |
| `consent_expires_at` | `TIMESTAMPTZ` | NOT NULL | Typically 90 days from grant |
| `consent_status` | `TEXT` | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, EXPIRING, EXPIRED, REVOKED |
| `last_synced_at` | `TIMESTAMPTZ` | NULL | Last successful full sync |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**CHECK:** `consent_status IN ('ACTIVE', 'EXPIRING', 'EXPIRED', 'REVOKED')`

**Index:** `(user_id, institution_id)` UNIQUE — one active connection per bank per user.

#### `accounts`

A bank account within a connected institution.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | Denormalized from connected_institution for fast queries |
| `connected_institution_id` | `UUID` | FK → connected_institutions, NOT NULL | |
| `external_account_id` | `TEXT` | UNIQUE, NOT NULL | TrueLayer account ID. Dedup key. |
| `account_type` | `TEXT` | NOT NULL | CURRENT, SAVINGS, CREDIT_CARD |
| `display_name` | `TEXT` | NOT NULL | "AIB Current Account" — cleaned for display |
| `currency` | `TEXT` | NOT NULL, DEFAULT 'EUR' | |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT true | False if disconnected but we retain history |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**CHECK:** `account_type IN ('CURRENT', 'SAVINGS', 'CREDIT_CARD')`

**Why `user_id` is denormalized here:** Every transaction query needs to scope by user. Without `user_id` on `accounts`, every query would need to JOIN through `connected_institutions`. At millions of transaction rows, that JOIN cost is significant. The denormalization is worth the minor write-time duplication.

#### `balances`

Separate from accounts because balances change on every sync but account metadata doesn't.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `account_id` | `UUID` | FK → accounts, NOT NULL | |
| `current` | `NUMERIC(12,2)` | NOT NULL | Current balance |
| `available` | `NUMERIC(12,2)` | NULL | Available balance (may differ from current due to pending txns) |
| `currency` | `TEXT` | NOT NULL, DEFAULT 'EUR' | |
| `fetched_at` | `TIMESTAMPTZ` | NOT NULL | When this balance was fetched from the bank |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Index:** `(account_id, fetched_at DESC)` — latest balance per account.

**Why a separate table?** Two reasons: (1) We keep balance history, enabling "balance over time" charts in a future release. (2) The `accounts` table is read far more often than it's updated — keeping volatile balance data separate avoids unnecessary row-level locks on account reads.

#### `transactions`

The highest-volume table. Everything revolves around this.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `account_id` | `UUID` | FK → accounts, NOT NULL | |
| `user_id` | `UUID` | FK → users, NOT NULL | Denormalized. Every query filters by user. |
| `external_transaction_id` | `TEXT` | UNIQUE, NOT NULL | TrueLayer transaction ID. Dedup key. |
| `amount` | `NUMERIC(12,2)` | NOT NULL | Negative = outgoing, positive = incoming |
| `currency` | `TEXT` | NOT NULL, DEFAULT 'EUR' | |
| `description` | `TEXT` | NOT NULL | Raw description from bank |
| `merchant_id` | `UUID` | FK → merchants, NULL | Set after categorisation. NULL if no merchant match. |
| `category_id` | `TEXT` | FK → categories, NOT NULL, DEFAULT 'OTHER' | |
| `is_pending` | `BOOLEAN` | NOT NULL, DEFAULT false | Pending transactions may be revised by the bank |
| `booked_at` | `TIMESTAMPTZ` | NOT NULL | When the bank booked the transaction |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | When we first synced it |

**Sign convention:** Negative amounts are money leaving the account (spending, payments, transfers out). Positive amounts are money entering (salary, refunds, transfers in). This matches what banks return and avoids a separate `direction` column.

**Indexes:**
- `(user_id, booked_at DESC)` — primary feed query
- `(account_id, booked_at DESC)` — per-account feed
- `(user_id, category_id, booked_at DESC)` — category drill-down
- `(external_transaction_id)` UNIQUE — dedup during sync
- `(merchant_id)` — merchant-level analytics

---

### Domain 3: Categorisation

#### `categories`

Reference table. Seeded once, rarely changes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `TEXT` | PK | GROCERIES, DINING, TRANSPORT, etc. Natural key, not UUID. |
| `label` | `TEXT` | NOT NULL | "Groceries", "Dining & Takeaway" |
| `icon` | `TEXT` | NOT NULL | Icon name from @expo/vector-icons |
| `color` | `TEXT` | NOT NULL | Hex color for charts, e.g. '#22c55e' |
| `sort_order` | `INTEGER` | NOT NULL, DEFAULT 0 | Display ordering |
| `is_expense` | `BOOLEAN` | NOT NULL, DEFAULT true | False for INCOME, TRANSFERS |

**Why TEXT PK instead of UUID?** Categories are a small, stable set. Using the human-readable key as the PK means:
- No JOINs needed for display — `transaction.category_id` is already 'GROCERIES'
- Foreign keys are self-documenting in raw SQL
- No lookup table JOIN needed in 90% of queries

**Seed data (12 rows):**

```
GROCERIES, DINING, TRANSPORT, ENTERTAINMENT, SHOPPING,
BILLS, HEALTH, SUBSCRIPTIONS, TRANSFERS, INCOME, ATM, OTHER
```

#### `merchants`

Known merchants, built up over time from transaction data and admin curation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `name` | `TEXT` | NOT NULL | Cleaned name: "Tesco", "Netflix", "Uber" |
| `raw_patterns` | `TEXT[]` | NOT NULL, DEFAULT '{}' | Array of raw bank description patterns that match this merchant, e.g. `{'TESCO STORES%', 'TESCO EXPRESS%'}` |
| `default_category_id` | `TEXT` | FK → categories, NOT NULL, DEFAULT 'OTHER' | Default category assigned when this merchant is detected |
| `logo_url` | `TEXT` | NULL | |
| `is_subscription` | `BOOLEAN` | NOT NULL, DEFAULT false | Hint for recurring payment detection |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Index:** GIN index on `raw_patterns` for pattern matching during categorisation.

**Why a merchants table?** Raw bank descriptions are messy: `"POS TESCO STORES 3219 DUBLIN"`. The merchants table maps these to clean names and default categories. The `raw_patterns` column holds LIKE patterns used during the categorisation pipeline: `WHERE description ILIKE ANY(merchant.raw_patterns)`.

#### `merchant_overrides`

Per-user category overrides. When a user re-categorises a transaction from merchant X, all future transactions from X use the new category for that user.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | |
| `merchant_id` | `UUID` | FK → merchants, NOT NULL | |
| `category_id` | `TEXT` | FK → categories, NOT NULL | User's preferred category for this merchant |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Index:** `(user_id, merchant_id)` UNIQUE — one override per merchant per user.

**Categorisation priority order:**
1. `merchant_overrides` (user-specific) — highest priority
2. `merchants.default_category_id` (global rules)
3. TrueLayer's classification field
4. Fallback: `OTHER`

---

### Domain 4: Analytics

#### `recurring_payments`

Auto-detected subscriptions and recurring charges.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | |
| `merchant_id` | `UUID` | FK → merchants, NULL | NULL if merchant not yet identified |
| `merchant_name` | `TEXT` | NOT NULL | Fallback display name if no merchant match |
| `average_amount` | `NUMERIC(12,2)` | NOT NULL | Average of detected occurrences |
| `currency` | `TEXT` | NOT NULL, DEFAULT 'EUR' | |
| `frequency` | `TEXT` | NOT NULL | WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, YEARLY |
| `category_id` | `TEXT` | FK → categories, NOT NULL, DEFAULT 'SUBSCRIPTIONS' | |
| `occurrence_count` | `INTEGER` | NOT NULL, DEFAULT 0 | How many times we've seen this charge |
| `first_seen_at` | `TIMESTAMPTZ` | NOT NULL | Date of first detected occurrence |
| `last_seen_at` | `TIMESTAMPTZ` | NOT NULL | Date of most recent occurrence |
| `next_expected_at` | `TIMESTAMPTZ` | NULL | Predicted next charge date |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT true | False if no occurrence in 2x the expected interval |
| `is_dismissed` | `BOOLEAN` | NOT NULL, DEFAULT false | User dismissed this as a false positive |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**CHECK:** `frequency IN ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')`

**Index:** `(user_id, is_active)` — "show me active subscriptions".

**Detection algorithm (runs nightly):**
1. Group transactions by user + normalised merchant name
2. Filter groups with 2+ occurrences
3. Check if amounts are within 10% variance
4. Check if intervals match a known frequency (±3 days tolerance)
5. Upsert into `recurring_payments`
6. Mark as inactive if 2x the interval has passed with no new occurrence

#### `budgets`

Per-category spending limits with period tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | |
| `category_id` | `TEXT` | FK → categories, NOT NULL | |
| `limit_amount` | `NUMERIC(12,2)` | NOT NULL | |
| `period` | `TEXT` | NOT NULL | WEEKLY, FORTNIGHTLY, MONTHLY |
| `period_start_day` | `INTEGER` | NOT NULL, DEFAULT 1 | 1=Monday for weekly, 1–28 for monthly |
| `alert_at_percent` | `INTEGER` | NOT NULL, DEFAULT 80 | Push notification threshold |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT true | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**CHECK:** `period IN ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY')`
**CHECK:** `limit_amount > 0`
**CHECK:** `alert_at_percent BETWEEN 1 AND 100`

**Index:** `(user_id, category_id)` UNIQUE WHERE `is_active = true` — one active budget per category per user.

#### `budget_snapshots`

Historical record of budget performance per period. Computed by a job at the end of each period.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `budget_id` | `UUID` | FK → budgets, NOT NULL | |
| `user_id` | `UUID` | FK → users, NOT NULL | Denormalized for fast queries |
| `period_start` | `DATE` | NOT NULL | First day of the budget period |
| `period_end` | `DATE` | NOT NULL | Last day of the budget period |
| `limit_amount` | `NUMERIC(12,2)` | NOT NULL | Snapshot of the limit at that time |
| `spent_amount` | `NUMERIC(12,2)` | NOT NULL | Actual spend computed from transactions |
| `transaction_count` | `INTEGER` | NOT NULL, DEFAULT 0 | |
| `was_over_budget` | `BOOLEAN` | NOT NULL | spent_amount > limit_amount |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Index:** `(budget_id, period_start DESC)` — budget history.
**Index:** `(user_id, period_start DESC)` — user's budget history across all categories.

**Why snapshot instead of computing on the fly?** Once a period ends, its data is frozen. Computing "was I over budget in March?" from raw transactions every time is wasteful and gets slower as transaction history grows. Snapshots are cheap to store and make historical analytics instant.

#### `weekly_summaries`

Pre-computed weekly spending summaries. One row per user per week.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | |
| `week_start` | `DATE` | NOT NULL | Monday of the week |
| `week_end` | `DATE` | NOT NULL | Sunday of the week |
| `total_spent` | `NUMERIC(12,2)` | NOT NULL, DEFAULT 0 | Sum of negative transaction amounts |
| `total_earned` | `NUMERIC(12,2)` | NOT NULL, DEFAULT 0 | Sum of positive transaction amounts |
| `net_flow` | `NUMERIC(12,2)` | NOT NULL, DEFAULT 0 | earned - spent (both as positive numbers) |
| `transaction_count` | `INTEGER` | NOT NULL, DEFAULT 0 | |
| `top_category_id` | `TEXT` | FK → categories, NULL | Category with highest spend this week |
| `top_category_amount` | `NUMERIC(12,2)` | NULL | Amount spent in top category |
| `category_breakdown` | `JSONB` | NOT NULL, DEFAULT '{}' | `{"GROCERIES": 89.50, "DINING": 45.00, ...}` |
| `compared_to_prev_week_pct` | `NUMERIC(5,2)` | NULL | Percentage change in spending vs previous week |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Index:** `(user_id, week_start DESC)` UNIQUE — one summary per user per week.

**Why JSONB for `category_breakdown`?** The breakdown is read-only after computation and always consumed as a whole object. Normalizing into a separate `weekly_summary_categories` table would add a JOIN for every dashboard load with no querying benefit — we never query "all weeks where groceries > €100" at this stage.

#### `insights`

Generated plain-English insight cards shown on the home screen.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | |
| `type` | `TEXT` | NOT NULL | WEEKLY_DIGEST, BUDGET_WARNING, UNUSUAL_SPEND, SUBSCRIPTION_NEW, SUBSCRIPTION_INCREASE |
| `title` | `TEXT` | NOT NULL | "You spent 12% less this week" |
| `body` | `TEXT` | NOT NULL | "€247 total, mostly on Dining (€89). Nice improvement from last week's €280." |
| `data` | `JSONB` | NOT NULL, DEFAULT '{}' | Structured data for frontend rendering: amounts, percentages, category IDs |
| `priority` | `INTEGER` | NOT NULL, DEFAULT 0 | Higher = more important. Used for ordering. |
| `is_read` | `BOOLEAN` | NOT NULL, DEFAULT false | |
| `expires_at` | `TIMESTAMPTZ` | NULL | Auto-cleanup: remove stale insights |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**CHECK:** `type IN ('WEEKLY_DIGEST', 'BUDGET_WARNING', 'UNUSUAL_SPEND', 'SUBSCRIPTION_NEW', 'SUBSCRIPTION_INCREASE')`

**Index:** `(user_id, is_read, created_at DESC)` — "show me unread insights, newest first".
**Index:** `(expires_at)` WHERE `expires_at IS NOT NULL` — cleanup job.

**Why both `title`/`body` AND `data`?** The plain-text fields are for push notifications and simple display. The `data` JSONB is for rich frontend rendering — amount badges, category icons, comparison arrows. This lets us change the frontend rendering without re-computing insights.

---

### Domain 5: Operations

#### `sync_jobs`

Tracks every sync attempt. Critical for debugging and showing sync status to users.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | |
| `connected_institution_id` | `UUID` | FK → connected_institutions, NULL | NULL for system-wide jobs |
| `account_id` | `UUID` | FK → accounts, NULL | NULL for institution-level syncs |
| `job_type` | `TEXT` | NOT NULL | INITIAL_SYNC, INCREMENTAL_SYNC, WEBHOOK_SYNC, TOKEN_REFRESH, BALANCE_UPDATE |
| `status` | `TEXT` | NOT NULL, DEFAULT 'PENDING' | PENDING, RUNNING, COMPLETED, FAILED, RETRYING |
| `started_at` | `TIMESTAMPTZ` | NULL | |
| `completed_at` | `TIMESTAMPTZ` | NULL | |
| `error_message` | `TEXT` | NULL | Human-readable error if failed |
| `error_code` | `TEXT` | NULL | Machine-readable: RATE_LIMITED, TOKEN_EXPIRED, PROVIDER_DOWN, etc. |
| `transactions_synced` | `INTEGER` | NOT NULL, DEFAULT 0 | Count of new/updated transactions |
| `attempt_number` | `INTEGER` | NOT NULL, DEFAULT 1 | Which retry attempt this is |
| `metadata` | `JSONB` | NOT NULL, DEFAULT '{}' | BullMQ job ID, sync range dates, etc. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**CHECK:** `job_type IN ('INITIAL_SYNC', 'INCREMENTAL_SYNC', 'WEBHOOK_SYNC', 'TOKEN_REFRESH', 'BALANCE_UPDATE')`
**CHECK:** `status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING')`

**Indexes:**
- `(user_id, created_at DESC)` — user's sync history
- `(status, created_at)` WHERE `status IN ('PENDING', 'RUNNING')` — active jobs dashboard
- `(connected_institution_id, created_at DESC)` — per-institution sync history

**Why track sync jobs in the database?** BullMQ stores jobs in Redis, but Redis is ephemeral. Sync history is important for:
- Showing users "Last synced 2 hours ago"
- Debugging why a user's data is stale
- Detecting patterns (a specific bank failing repeatedly)
- Audit trail

#### `notifications`

Push notification history. Prevents duplicate sends and enables "notification center" in the app.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL | |
| `type` | `TEXT` | NOT NULL | WEEKLY_DIGEST, BUDGET_ALERT, CONSENT_EXPIRING, SYNC_FAILED, INSIGHT |
| `title` | `TEXT` | NOT NULL | Notification title |
| `body` | `TEXT` | NOT NULL | Notification body |
| `data` | `JSONB` | NOT NULL, DEFAULT '{}' | Deep link target, related entity IDs |
| `channel` | `TEXT` | NOT NULL, DEFAULT 'PUSH' | PUSH, IN_APP, EMAIL |
| `sent_at` | `TIMESTAMPTZ` | NULL | NULL if not yet sent (queued) |
| `read_at` | `TIMESTAMPTZ` | NULL | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**CHECK:** `type IN ('WEEKLY_DIGEST', 'BUDGET_ALERT', 'CONSENT_EXPIRING', 'SYNC_FAILED', 'INSIGHT')`

**Index:** `(user_id, created_at DESC)` — notification feed.
**Index:** `(user_id, type, sent_at)` — dedup check: "did we already send a budget alert for this period?"

#### `audit_logs`

Immutable log of security-sensitive actions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | NULL | NULL for system actions |
| `action` | `TEXT` | NOT NULL | BANK_CONNECTED, BANK_DISCONNECTED, DATA_EXPORTED, ACCOUNT_DELETED, TOKEN_REFRESHED, CONSENT_EXPIRED |
| `entity_type` | `TEXT` | NULL | 'connected_institution', 'account', 'user', etc. |
| `entity_id` | `TEXT` | NULL | UUID of the affected entity |
| `metadata` | `JSONB` | NOT NULL, DEFAULT '{}' | Additional context (IP address, user agent for export/delete) |
| `ip_address` | `INET` | NULL | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**This table is INSERT-ONLY. No UPDATEs, no DELETEs.** Enforced by application-level policy and optionally by a trigger that prevents UPDATE/DELETE.

**Index:** `(user_id, created_at DESC)` — user's audit trail.
**Index:** `(action, created_at DESC)` — "show me all bank disconnections this week".

---

## 2. Key Design Decisions

### Normalization vs Denormalization

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `user_id` on `transactions` | **Denormalized** | Every transaction query filters by user. Without this, every query JOINs through `accounts` → `connected_institutions` → `users`. At 10M+ rows, that JOIN cost is significant. |
| `user_id` on `accounts` | **Denormalized** | Same reasoning. Account list is the second most common query. |
| `user_id` on `budget_snapshots` | **Denormalized** | "Show me all my budget history" shouldn't require joining through budgets. |
| `category_breakdown` as JSONB on `weekly_summaries` | **Denormalized** | This data is always read as a whole object, never queried by individual category in the summary context. |
| `merchant_name` on `recurring_payments` | **Denormalized** | Keeps working even if the merchant isn't in the `merchants` table yet. |
| `categories` as TEXT PK | **Normalized (natural key)** | 12 rows, never changes. TEXT FK is self-documenting and eliminates JOINs for category display. |
| `balances` as separate table | **Normalized** | Balance history is a different access pattern than account metadata. Separate table avoids unnecessary locking. |
| `insights.title`/`body` alongside `data` | **Intentional duplication** | Different consumers: push notifications use text, mobile app uses JSONB. Computing one from the other adds coupling. |

### UUID vs Serial vs Natural Key

| Table | PK Type | Why |
|-------|---------|-----|
| Most tables | `UUID` | No sequential guessing. Safe for client-side generation. Works across distributed systems. |
| `categories` | `TEXT` | Small, stable reference data. Natural key eliminates JOINs. |
| `institutions` | `TEXT` | TrueLayer provider ID is the natural key. No benefit to adding a surrogate. |

### Soft Delete Strategy

Only `users` has `deleted_at`. When a user requests account deletion:

1. Set `users.deleted_at = now()`
2. Background job runs after 48 hours (GDPR cooling-off period)
3. Hard deletes cascade through all related tables
4. Audit log records the deletion event (retained for compliance)

Other tables use `is_active` flags where a "hidden but retained" state is needed (accounts, budgets, recurring_payments).

---

## 3. Index Summary

```
-- Identity
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_supabase_id ON users(supabase_id);

-- Banking
CREATE UNIQUE INDEX idx_conn_inst_user_institution
  ON connected_institutions(user_id, institution_id);

CREATE UNIQUE INDEX idx_accounts_external_id
  ON accounts(external_account_id);
CREATE INDEX idx_accounts_user
  ON accounts(user_id);

CREATE INDEX idx_balances_account_fetched
  ON balances(account_id, fetched_at DESC);

CREATE UNIQUE INDEX idx_txn_external_id
  ON transactions(external_transaction_id);
CREATE INDEX idx_txn_user_booked
  ON transactions(user_id, booked_at DESC);
CREATE INDEX idx_txn_account_booked
  ON transactions(account_id, booked_at DESC);
CREATE INDEX idx_txn_user_category_booked
  ON transactions(user_id, category_id, booked_at DESC);
CREATE INDEX idx_txn_merchant
  ON transactions(merchant_id) WHERE merchant_id IS NOT NULL;

-- Categorisation
CREATE INDEX idx_merchants_patterns
  ON merchants USING GIN(raw_patterns);
CREATE UNIQUE INDEX idx_merchant_overrides_user_merchant
  ON merchant_overrides(user_id, merchant_id);

-- Analytics
CREATE INDEX idx_recurring_user_active
  ON recurring_payments(user_id, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX idx_budgets_user_category_active
  ON budgets(user_id, category_id) WHERE is_active = true;
CREATE INDEX idx_budget_snap_budget_period
  ON budget_snapshots(budget_id, period_start DESC);
CREATE UNIQUE INDEX idx_weekly_user_week
  ON weekly_summaries(user_id, week_start DESC);
CREATE INDEX idx_insights_user_unread
  ON insights(user_id, is_read, created_at DESC);

-- Operations
CREATE INDEX idx_sync_jobs_user_created
  ON sync_jobs(user_id, created_at DESC);
CREATE INDEX idx_sync_jobs_active
  ON sync_jobs(status, created_at) WHERE status IN ('PENDING', 'RUNNING');
CREATE INDEX idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX idx_audit_user_created
  ON audit_logs(user_id, created_at DESC);
```

**Partial indexes** (the `WHERE` clauses) keep index size small by only indexing rows that match active queries. For example, `idx_sync_jobs_active` only indexes pending/running jobs — completed jobs (99%+ of rows) don't bloat the index.

---

## 4. Audit & Security Considerations

### Row-Level Security

Every query MUST include `WHERE user_id = ?` sourced from the JWT, never from URL parameters. This is enforced at the application layer (Prisma query wrappers) and can be additionally enforced via PostgreSQL Row-Level Security policies:

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_user_isolation ON transactions
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

### Encrypted Columns

| Column | Encryption | Key Source |
|--------|-----------|------------|
| `connected_institutions.access_token_enc` | AES-256-GCM | `TOKEN_ENCRYPTION_KEY` env var |
| `connected_institutions.refresh_token_enc` | AES-256-GCM | `TOKEN_ENCRYPTION_KEY` env var |

These are the only columns that hold secrets. Every other column is either non-sensitive or is PII that's protected by access control rather than field-level encryption.

### Immutable Tables

`audit_logs` is append-only. Enforce with:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table is immutable — INSERT only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit_logs
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

### Cascading Deletes

```
users (hard delete) →
  ├── connected_institutions (CASCADE)
  │     └── sync_jobs (SET NULL on connected_institution_id)
  ├── accounts (CASCADE)
  │     ├── balances (CASCADE)
  │     └── transactions (CASCADE)
  ├── budgets (CASCADE)
  │     └── budget_snapshots (CASCADE)
  ├── recurring_payments (CASCADE)
  ├── weekly_summaries (CASCADE)
  ├── insights (CASCADE)
  ├── notifications (CASCADE)
  ├── merchant_overrides (CASCADE)
  └── audit_logs (RETAINED — no FK, user_id is informational only)
```

### Data Retention

| Table | Retention | Rationale |
|-------|-----------|-----------|
| `transactions` | Indefinite (while user exists) | Core data. Users expect to see historical transactions. |
| `balances` | 12 months rolling | Balance history for charts. Older balances pruned by cron job. |
| `sync_jobs` | 90 days | Debugging value degrades after 3 months. Prune via cron. |
| `notifications` | 90 days | Notification history. Prune via cron. |
| `insights` | 90 days OR until `expires_at` | Time-sensitive content. Prune expired rows daily. |
| `audit_logs` | 7 years | Compliance. Financial services typically require 5-7 year retention. |
| `weekly_summaries` | Indefinite | Small table (~52 rows/user/year). Historical trend data. |
| `budget_snapshots` | Indefinite | Small table. Historical budget performance. |

---

## 5. Updated Timestamp Trigger

Applied to every table with an `updated_at` column:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each table:
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repeat for: connected_institutions, accounts, merchant_overrides,
--             recurring_payments, budgets
```

---

## 6. Full SQL CREATE TABLE Statements

```sql
-- ============================================================
-- ClearMoney Production Schema
-- PostgreSQL 16+
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DOMAIN 1: IDENTITY
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  supabase_id     TEXT NOT NULL,
  display_name    TEXT,
  timezone        TEXT NOT NULL DEFAULT 'Europe/Dublin',
  currency        TEXT NOT NULL DEFAULT 'EUR',
  onboarded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_supabase_id UNIQUE (supabase_id)
);

-- ============================================================
-- DOMAIN 2: BANKING
-- ============================================================

CREATE TABLE institutions (
  id              TEXT PRIMARY KEY,  -- TrueLayer provider ID, e.g. 'ie-ob-aib'
  name            TEXT NOT NULL,
  country         TEXT NOT NULL DEFAULT 'IE',
  logo_url        TEXT,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE connected_institutions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id      TEXT NOT NULL REFERENCES institutions(id),
  access_token_enc    TEXT NOT NULL,
  refresh_token_enc   TEXT NOT NULL,
  consent_granted_at  TIMESTAMPTZ NOT NULL,
  consent_expires_at  TIMESTAMPTZ NOT NULL,
  consent_status      TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (consent_status IN ('ACTIVE', 'EXPIRING', 'EXPIRED', 'REVOKED')),
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_conn_inst_user_institution UNIQUE (user_id, institution_id)
);

CREATE TABLE accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_institution_id UUID NOT NULL REFERENCES connected_institutions(id) ON DELETE CASCADE,
  external_account_id     TEXT NOT NULL,
  account_type            TEXT NOT NULL
                          CHECK (account_type IN ('CURRENT', 'SAVINGS', 'CREDIT_CARD')),
  display_name            TEXT NOT NULL,
  currency                TEXT NOT NULL DEFAULT 'EUR',
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_accounts_external_id UNIQUE (external_account_id)
);

CREATE INDEX idx_accounts_user ON accounts(user_id);

CREATE TABLE balances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  current     NUMERIC(12,2) NOT NULL,
  available   NUMERIC(12,2),
  currency    TEXT NOT NULL DEFAULT 'EUR',
  fetched_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_balances_account_fetched ON balances(account_id, fetched_at DESC);

-- ============================================================
-- DOMAIN 3: CATEGORISATION
-- ============================================================

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,  -- 'GROCERIES', 'DINING', etc.
  label       TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_expense  BOOLEAN NOT NULL DEFAULT true
);

-- Seed categories
INSERT INTO categories (id, label, icon, color, sort_order, is_expense) VALUES
  ('GROCERIES',     'Groceries',          'cart',               '#22c55e', 1,  true),
  ('DINING',        'Dining & Takeaway',  'restaurant',         '#f97316', 2,  true),
  ('TRANSPORT',     'Transport',          'bus',                '#3b82f6', 3,  true),
  ('ENTERTAINMENT', 'Entertainment',      'film',               '#a855f7', 4,  true),
  ('SHOPPING',      'Shopping',           'bag',                '#ec4899', 5,  true),
  ('BILLS',         'Bills & Utilities',  'receipt',            '#64748b', 6,  true),
  ('HEALTH',        'Health & Fitness',   'heart',              '#ef4444', 7,  true),
  ('SUBSCRIPTIONS', 'Subscriptions',      'refresh',            '#8b5cf6', 8,  true),
  ('TRANSFERS',     'Transfers',          'swap-horizontal',    '#06b6d4', 9,  false),
  ('INCOME',        'Income',             'cash',               '#10b981', 10, false),
  ('ATM',           'Cash & ATM',         'cash-outline',       '#f59e0b', 11, true),
  ('OTHER',         'Other',              'ellipsis-horizontal','#94a3b8', 12, true);

CREATE TABLE merchants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  raw_patterns        TEXT[] NOT NULL DEFAULT '{}',
  default_category_id TEXT NOT NULL DEFAULT 'OTHER' REFERENCES categories(id),
  logo_url            TEXT,
  is_subscription     BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchants_patterns ON merchants USING GIN(raw_patterns);

CREATE TABLE merchant_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id  UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL REFERENCES categories(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_merchant_overrides_user_merchant UNIQUE (user_id, merchant_id)
);

-- ============================================================
-- TRANSACTIONS (highest-volume table)
-- ============================================================

CREATE TABLE transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_transaction_id TEXT NOT NULL,
  amount                  NUMERIC(12,2) NOT NULL,  -- negative = outgoing, positive = incoming
  currency                TEXT NOT NULL DEFAULT 'EUR',
  description             TEXT NOT NULL,
  merchant_id             UUID REFERENCES merchants(id) ON DELETE SET NULL,
  category_id             TEXT NOT NULL DEFAULT 'OTHER' REFERENCES categories(id),
  is_pending              BOOLEAN NOT NULL DEFAULT false,
  booked_at               TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_txn_external_id UNIQUE (external_transaction_id)
);

-- Primary feed: "my latest transactions"
CREATE INDEX idx_txn_user_booked ON transactions(user_id, booked_at DESC);

-- Per-account feed
CREATE INDEX idx_txn_account_booked ON transactions(account_id, booked_at DESC);

-- Category drill-down: "all my grocery spending this month"
CREATE INDEX idx_txn_user_category_booked ON transactions(user_id, category_id, booked_at DESC);

-- Merchant analytics
CREATE INDEX idx_txn_merchant ON transactions(merchant_id) WHERE merchant_id IS NOT NULL;

-- ============================================================
-- DOMAIN 4: ANALYTICS
-- ============================================================

CREATE TABLE recurring_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id       UUID REFERENCES merchants(id) ON DELETE SET NULL,
  merchant_name     TEXT NOT NULL,
  average_amount    NUMERIC(12,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  frequency         TEXT NOT NULL
                    CHECK (frequency IN ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  category_id       TEXT NOT NULL DEFAULT 'SUBSCRIPTIONS' REFERENCES categories(id),
  occurrence_count  INTEGER NOT NULL DEFAULT 0,
  first_seen_at     TIMESTAMPTZ NOT NULL,
  last_seen_at      TIMESTAMPTZ NOT NULL,
  next_expected_at  TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_dismissed      BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_user_active
  ON recurring_payments(user_id, is_active) WHERE is_active = true;

CREATE TABLE budgets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id       TEXT NOT NULL REFERENCES categories(id),
  limit_amount      NUMERIC(12,2) NOT NULL CHECK (limit_amount > 0),
  period            TEXT NOT NULL
                    CHECK (period IN ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY')),
  period_start_day  INTEGER NOT NULL DEFAULT 1,
  alert_at_percent  INTEGER NOT NULL DEFAULT 80
                    CHECK (alert_at_percent BETWEEN 1 AND 100),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_budgets_user_category_active
  ON budgets(user_id, category_id) WHERE is_active = true;

CREATE TABLE budget_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id         UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  limit_amount      NUMERIC(12,2) NOT NULL,
  spent_amount      NUMERIC(12,2) NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  was_over_budget   BOOLEAN NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_snap_budget_period
  ON budget_snapshots(budget_id, period_start DESC);
CREATE INDEX idx_budget_snap_user_period
  ON budget_snapshots(user_id, period_start DESC);

CREATE TABLE weekly_summaries (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start                DATE NOT NULL,
  week_end                  DATE NOT NULL,
  total_spent               NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_earned              NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_flow                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  transaction_count         INTEGER NOT NULL DEFAULT 0,
  top_category_id           TEXT REFERENCES categories(id),
  top_category_amount       NUMERIC(12,2),
  category_breakdown        JSONB NOT NULL DEFAULT '{}',
  compared_to_prev_week_pct NUMERIC(5,2),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_weekly_user_week UNIQUE (user_id, week_start)
);

CREATE TABLE insights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN (
                'WEEKLY_DIGEST', 'BUDGET_WARNING', 'UNUSUAL_SPEND',
                'SUBSCRIPTION_NEW', 'SUBSCRIPTION_INCREASE'
              )),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  priority    INTEGER NOT NULL DEFAULT 0,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insights_user_unread
  ON insights(user_id, is_read, created_at DESC);
CREATE INDEX idx_insights_expiry
  ON insights(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- DOMAIN 5: OPERATIONS
-- ============================================================

CREATE TABLE sync_jobs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_institution_id  UUID REFERENCES connected_institutions(id) ON DELETE SET NULL,
  account_id                UUID REFERENCES accounts(id) ON DELETE SET NULL,
  job_type                  TEXT NOT NULL
                            CHECK (job_type IN (
                              'INITIAL_SYNC', 'INCREMENTAL_SYNC', 'WEBHOOK_SYNC',
                              'TOKEN_REFRESH', 'BALANCE_UPDATE'
                            )),
  status                    TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING')),
  started_at                TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ,
  error_message             TEXT,
  error_code                TEXT,
  transactions_synced       INTEGER NOT NULL DEFAULT 0,
  attempt_number            INTEGER NOT NULL DEFAULT 1,
  metadata                  JSONB NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_jobs_user_created
  ON sync_jobs(user_id, created_at DESC);
CREATE INDEX idx_sync_jobs_active
  ON sync_jobs(status, created_at) WHERE status IN ('PENDING', 'RUNNING');
CREATE INDEX idx_sync_jobs_institution
  ON sync_jobs(connected_institution_id, created_at DESC);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN (
                'WEEKLY_DIGEST', 'BUDGET_ALERT', 'CONSENT_EXPIRING',
                'SYNC_FAILED', 'INSIGHT'
              )),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  channel     TEXT NOT NULL DEFAULT 'PUSH'
              CHECK (channel IN ('PUSH', 'IN_APP', 'EMAIL')),
  sent_at     TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_type_sent
  ON notifications(user_id, type, sent_at);

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,  -- NULL for system actions, no FK (survives user deletion)
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action_created ON audit_logs(action, created_at DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON connected_institutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON merchant_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON recurring_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Protect audit_logs from modification
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only — INSERT only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit_logs
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================
-- SEED DATA: Irish institutions
-- ============================================================

INSERT INTO institutions (id, name, country) VALUES
  ('ie-ob-aib',   'AIB',              'IE'),
  ('ie-ob-boi',   'Bank of Ireland',  'IE'),
  ('ie-ob-ptsb',  'PTSB',             'IE'),
  ('ie-ob-kbc',   'KBC Ireland',      'IE'),
  ('ie-revolut',  'Revolut',          'IE'),
  ('ie-n26',      'N26',              'IE');

-- ============================================================
-- COMMON MERCHANT SEED DATA
-- ============================================================

INSERT INTO merchants (name, raw_patterns, default_category_id, is_subscription) VALUES
  ('Tesco',           ARRAY['%TESCO%'],                    'GROCERIES',     false),
  ('Lidl',            ARRAY['%LIDL%'],                     'GROCERIES',     false),
  ('Aldi',            ARRAY['%ALDI%'],                     'GROCERIES',     false),
  ('Dunnes Stores',   ARRAY['%DUNNES%'],                   'GROCERIES',     false),
  ('SuperValu',       ARRAY['%SUPERVALU%', '%SUPER VALU%'],'GROCERIES',     false),
  ('Centra',          ARRAY['%CENTRA%'],                   'GROCERIES',     false),
  ('Spar',            ARRAY['%SPAR %'],                    'GROCERIES',     false),
  ('Netflix',         ARRAY['%NETFLIX%'],                  'SUBSCRIPTIONS', true),
  ('Spotify',         ARRAY['%SPOTIFY%'],                  'SUBSCRIPTIONS', true),
  ('Disney+',         ARRAY['%DISNEY PLUS%', '%DISNEY+%'], 'SUBSCRIPTIONS', true),
  ('Apple',           ARRAY['%APPLE.COM%', '%APPLE SERV%'],'SUBSCRIPTIONS', true),
  ('Google',          ARRAY['%GOOGLE *%'],                 'SUBSCRIPTIONS', true),
  ('Amazon Prime',    ARRAY['%AMZN MKTP%', '%AMAZON PRIME%'], 'SUBSCRIPTIONS', true),
  ('Uber',            ARRAY['%UBER%'],                     'TRANSPORT',     false),
  ('Bolt',            ARRAY['%BOLT.EU%'],                  'TRANSPORT',     false),
  ('Dublin Bus',      ARRAY['%DUBLIN BUS%', '%DUBLINBUS%'],'TRANSPORT',     false),
  ('Leap Card',       ARRAY['%LEAP%'],                     'TRANSPORT',     false),
  ('Irish Rail',      ARRAY['%IRISH RAIL%', '%IRISHRAIL%'],'TRANSPORT',     false),
  ('Deliveroo',       ARRAY['%DELIVEROO%'],                'DINING',        false),
  ('Just Eat',        ARRAY['%JUST EAT%', '%JUSTEAT%'],   'DINING',        false),
  ('McDonald''s',     ARRAY['%MCDONALDS%', '%MCDONALD%'], 'DINING',        false),
  ('Starbucks',       ARRAY['%STARBUCKS%'],                'DINING',        false),
  ('Electric Ireland',ARRAY['%ELECTRIC IRELAND%'],         'BILLS',         true),
  ('Bord Gáis',       ARRAY['%BORD GAIS%', '%BORDGAIS%'], 'BILLS',         true),
  ('Virgin Media',    ARRAY['%VIRGIN MEDIA%'],             'BILLS',         true),
  ('Eir',             ARRAY['%EIR %', '%EIRCOM%'],         'BILLS',         true),
  ('Three Ireland',   ARRAY['%THREE IRELAND%', '%3IRELAND%'], 'BILLS',      true),
  ('Vodafone',        ARRAY['%VODAFONE%'],                 'BILLS',         true),
  ('Irish Water',     ARRAY['%IRISH WATER%'],              'BILLS',         true),
  ('Revenue',         ARRAY['%REVENUE.IE%', '%REVENUE COMM%'], 'BILLS',     false),
  ('Gym+Coffee',      ARRAY['%GYM+COFFEE%', '%GYM COFFEE%'], 'HEALTH',     false),
  ('Penneys',         ARRAY['%PENNEYS%', '%PRIMARK%'],     'SHOPPING',      false),
  ('Zara',            ARRAY['%ZARA %'],                    'SHOPPING',      false),
  ('Cineworld',       ARRAY['%CINEWORLD%'],                'ENTERTAINMENT', false),
  ('Ticketmaster',    ARRAY['%TICKETMASTER%'],             'ENTERTAINMENT', false);
```

---

## 7. Capacity Estimates

| Table | Rows per user (year 1) | At 10k users | At 100k users | Growth rate |
|-------|----------------------|-------------|--------------|-------------|
| `users` | 1 | 10k | 100k | New signups |
| `institutions` | — | ~10 (static) | ~10 | Rarely changes |
| `connected_institutions` | 1–3 | 20k | 200k | Slow |
| `accounts` | 1–5 | 30k | 300k | Slow |
| `balances` | ~730 (2/day) | 7.3M | 73M | 2/day/account |
| `transactions` | ~1,500 | 15M | 150M | ~30/week/user |
| `merchants` | — | ~500 (shared) | ~2,000 | Grows with merchant diversity |
| `merchant_overrides` | 0–20 | 100k | 1M | Slow |
| `categories` | — | 12 (static) | 12 | Never |
| `recurring_payments` | 5–15 | 100k | 1M | Slow |
| `budgets` | 3–8 | 50k | 500k | Slow |
| `budget_snapshots` | ~52/year | 520k | 5.2M | Weekly |
| `weekly_summaries` | 52/year | 520k | 5.2M | Weekly |
| `insights` | ~100/year (pruned) | 500k | 5M | Weekly + events |
| `sync_jobs` | ~1,460/year (4/day, pruned to 90 days) | 1M | 10M | 4/day/user |
| `notifications` | ~100/year (pruned) | 500k | 5M | Weekly + events |
| `audit_logs` | ~20/year | 200k | 2M | Low volume |

**`transactions` is the dominant table.** At 100k users, it holds ~150M rows. PostgreSQL handles this well with the composite indexes above. If it becomes a bottleneck beyond 500k users, partition by `booked_at` (monthly range partitions).

**`balances` grows fast** (2 fetches/day/account). The 12-month rolling retention policy keeps it bounded. At 100k users with 3 accounts each, that's ~73M rows before pruning, ~22M after (12 months).
