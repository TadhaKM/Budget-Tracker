# ClearMoney — REST API Design

## Base URL

```
Production:  https://api.clearmoney.app/v1
Staging:     https://api-staging.clearmoney.app/v1
Development: http://localhost:3001/v1
```

---

## 1. Complete Route Map

### Operations / Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Liveness check |
| `GET` | `/health/ready` | No | Readiness check (DB + Redis) |

### Auth & Onboarding

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/auth/register` | No | Create user from Supabase token (first launch) |
| `GET` | `/v1/auth/me` | Yes | Get current user profile |
| `PATCH` | `/v1/auth/me` | Yes | Update display name, timezone, currency |
| `DELETE` | `/v1/auth/me` | Yes | Request account deletion (soft delete) |
| `POST` | `/v1/auth/me/export` | Yes | Request CSV data export |
| `GET` | `/v1/auth/onboarding` | Yes | Get onboarding progress |
| `POST` | `/v1/auth/onboarding/complete` | Yes | Mark onboarding as complete |

### Bank Connections

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/institutions` | Yes | List available banks |
| `POST` | `/v1/connections` | Yes | Start bank connection (get TrueLayer auth URL) |
| `GET` | `/v1/connections` | Yes | List user's connected banks |
| `GET` | `/v1/connections/:id` | Yes | Get connection detail + consent status |
| `DELETE` | `/v1/connections/:id` | Yes | Disconnect a bank |
| `POST` | `/v1/connections/:id/refresh` | Yes | Trigger consent re-auth |
| `GET` | `/v1/connections/callback` | No | TrueLayer OAuth callback (redirect target) |

### Accounts & Balances

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/accounts` | Yes | List all accounts with latest balance |
| `GET` | `/v1/accounts/:id` | Yes | Get single account with balance |
| `POST` | `/v1/accounts/:id/sync` | Yes | Trigger manual sync |
| `GET` | `/v1/accounts/:id/balances` | Yes | Balance history for an account |

### Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/transactions` | Yes | Paginated transaction feed (filterable) |
| `GET` | `/v1/transactions/:id` | Yes | Single transaction detail |
| `PATCH` | `/v1/transactions/:id` | Yes | Re-categorise a transaction |
| `GET` | `/v1/transactions/search` | Yes | Full-text search by description/merchant |

### Budgets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/budgets` | Yes | List active budgets with current spend |
| `POST` | `/v1/budgets` | Yes | Create a budget |
| `GET` | `/v1/budgets/:id` | Yes | Budget detail with current spend |
| `PATCH` | `/v1/budgets/:id` | Yes | Update a budget |
| `DELETE` | `/v1/budgets/:id` | Yes | Deactivate a budget |
| `GET` | `/v1/budgets/:id/history` | Yes | Budget performance snapshots |

### Recurring Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/recurring` | Yes | List active recurring payments |
| `GET` | `/v1/recurring/:id` | Yes | Recurring payment detail |
| `PATCH` | `/v1/recurring/:id/dismiss` | Yes | Dismiss a false positive |

### Insights & Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/analytics/weekly` | Yes | Weekly summaries (last 12 weeks) |
| `GET` | `/v1/analytics/weekly/current` | Yes | Current week summary |
| `GET` | `/v1/analytics/categories` | Yes | Spending by category for a date range |
| `GET` | `/v1/insights` | Yes | Insight cards feed |
| `PATCH` | `/v1/insights/:id/read` | Yes | Mark insight as read |
| `POST` | `/v1/insights/read-all` | Yes | Mark all insights as read |

### Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/notifications` | Yes | Notification history |
| `PATCH` | `/v1/notifications/:id/read` | Yes | Mark notification as read |
| `POST` | `/v1/notifications/read-all` | Yes | Mark all as read |
| `GET` | `/v1/notifications/settings` | Yes | Get notification preferences |
| `PATCH` | `/v1/notifications/settings` | Yes | Update notification preferences |

### Sync Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/sync/status` | Yes | Latest sync jobs across all connections |

### Webhooks (External → Us)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/webhooks/truelayer` | HMAC | TrueLayer event receiver |

### Reference Data

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/categories` | Yes | List all categories |

**Total: 40 endpoints**

---

## 2. Request/Response Examples

### Envelope Format

Every response uses a consistent envelope. Success responses include the data at the top level. List endpoints wrap in a named key + pagination meta.

```
Success (single):
{
  "id": "...",
  "field": "value"
}

Success (list):
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6...",
    "hasMore": true,
    "total": 142          // only included when cheap to compute
  }
}

Error:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation",
    "details": [...]      // optional, field-level errors
  }
}
```

---

### POST /v1/auth/register

Called once on first app launch after Supabase auth completes. Creates the user record in our database.

```
Request:
POST /v1/auth/register
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "displayName": "Tadha",          // optional
  "timezone": "Europe/Dublin",     // optional, defaults to Europe/Dublin
  "currency": "EUR"                // optional, defaults to EUR
}

Response: 201 Created
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "tadha@example.com",
  "displayName": "Tadha",
  "timezone": "Europe/Dublin",
  "currency": "EUR",
  "onboardedAt": null,
  "createdAt": "2026-04-03T10:00:00.000Z"
}
```

---

### GET /v1/auth/me

```
Response: 200
{
  "id": "550e8400-...",
  "email": "tadha@example.com",
  "displayName": "Tadha",
  "timezone": "Europe/Dublin",
  "currency": "EUR",
  "onboardedAt": "2026-04-03T10:05:00.000Z",
  "createdAt": "2026-04-03T10:00:00.000Z",
  "stats": {
    "connectedBanks": 2,
    "totalAccounts": 3,
    "transactionCount": 847
  }
}
```

---

### GET /v1/institutions

```
Response: 200
{
  "data": [
    {
      "id": "ie-ob-aib",
      "name": "AIB",
      "country": "IE",
      "logoUrl": "https://cdn.clearmoney.app/banks/aib.png",
      "isAvailable": true
    },
    {
      "id": "ie-ob-boi",
      "name": "Bank of Ireland",
      "country": "IE",
      "logoUrl": "https://cdn.clearmoney.app/banks/boi.png",
      "isAvailable": true
    }
  ]
}
```

---

### POST /v1/connections

Initiate a bank connection. Returns a URL the mobile app opens in an in-app browser.

```
Request:
POST /v1/connections
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "institutionId": "ie-ob-aib"
}

Response: 201 Created
{
  "authUrl": "https://auth.truelayer-sandbox.com/?response_type=code&client_id=...&state=abc123",
  "state": "abc123",
  "expiresIn": 600
}
```

---

### GET /v1/connections

```
Response: 200
{
  "data": [
    {
      "id": "conn-uuid-1",
      "institution": {
        "id": "ie-ob-aib",
        "name": "AIB",
        "logoUrl": "https://cdn.clearmoney.app/banks/aib.png"
      },
      "consentStatus": "ACTIVE",
      "consentExpiresAt": "2026-07-03T10:05:00.000Z",
      "lastSyncedAt": "2026-04-03T09:30:00.000Z",
      "accountCount": 2,
      "createdAt": "2026-04-03T10:05:00.000Z"
    }
  ]
}
```

---

### GET /v1/accounts

```
Response: 200
{
  "data": [
    {
      "id": "acc-uuid-1",
      "displayName": "AIB Current Account",
      "accountType": "CURRENT",
      "currency": "EUR",
      "isActive": true,
      "institution": {
        "id": "ie-ob-aib",
        "name": "AIB",
        "logoUrl": "https://cdn.clearmoney.app/banks/aib.png"
      },
      "balance": {
        "current": 2847.50,
        "available": 2847.50,
        "fetchedAt": "2026-04-03T09:30:00.000Z"
      }
    },
    {
      "id": "acc-uuid-2",
      "displayName": "AIB Savings",
      "accountType": "SAVINGS",
      "currency": "EUR",
      "isActive": true,
      "institution": {
        "id": "ie-ob-aib",
        "name": "AIB",
        "logoUrl": "https://cdn.clearmoney.app/banks/aib.png"
      },
      "balance": {
        "current": 15230.00,
        "available": 15230.00,
        "fetchedAt": "2026-04-03T09:30:00.000Z"
      }
    }
  ],
  "summary": {
    "totalBalance": 18077.50,
    "totalAccounts": 2,
    "currency": "EUR"
  }
}
```

---

### GET /v1/accounts/:id/balances

Balance history for charts.

```
GET /v1/accounts/acc-uuid-1/balances?from=2026-03-01&to=2026-04-03

Response: 200
{
  "data": [
    { "current": 3100.00, "available": 3100.00, "fetchedAt": "2026-03-01T08:00:00.000Z" },
    { "current": 2950.00, "available": 2950.00, "fetchedAt": "2026-03-08T08:00:00.000Z" },
    { "current": 2847.50, "available": 2847.50, "fetchedAt": "2026-04-03T09:30:00.000Z" }
  ]
}
```

---

### GET /v1/transactions

```
GET /v1/transactions?limit=3&categoryId=DINING&from=2026-03-01T00:00:00Z

Response: 200
{
  "data": [
    {
      "id": "txn-uuid-1",
      "accountId": "acc-uuid-1",
      "amount": -14.50,
      "currency": "EUR",
      "description": "POS DELIVEROO DUBLIN",
      "merchant": {
        "id": "merch-uuid-1",
        "name": "Deliveroo",
        "logoUrl": null
      },
      "categoryId": "DINING",
      "isPending": false,
      "bookedAt": "2026-03-28T19:30:00.000Z"
    },
    {
      "id": "txn-uuid-2",
      "accountId": "acc-uuid-1",
      "amount": -8.90,
      "currency": "EUR",
      "description": "STARBUCKS GRAFTON ST",
      "merchant": {
        "id": "merch-uuid-2",
        "name": "Starbucks",
        "logoUrl": null
      },
      "categoryId": "DINING",
      "isPending": false,
      "bookedAt": "2026-03-25T08:15:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJib29rZWRBdCI6IjIwMjYtMDMtMjVUMDg6MTU6MDAuMDAwWiIsImlkIjoiIn0=",
    "hasMore": true
  }
}
```

---

### PATCH /v1/transactions/:id

Re-categorise a transaction. Also creates a merchant override so future transactions from the same merchant get the new category automatically.

```
Request:
PATCH /v1/transactions/txn-uuid-1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "categoryId": "GROCERIES"
}

Response: 200
{
  "id": "txn-uuid-1",
  "accountId": "acc-uuid-1",
  "amount": -14.50,
  "currency": "EUR",
  "description": "POS DELIVEROO DUBLIN",
  "merchant": {
    "id": "merch-uuid-1",
    "name": "Deliveroo",
    "logoUrl": null
  },
  "categoryId": "GROCERIES",
  "isPending": false,
  "bookedAt": "2026-03-28T19:30:00.000Z",
  "merchantOverrideCreated": true
}
```

---

### GET /v1/transactions/search

```
GET /v1/transactions/search?q=netflix&limit=10

Response: 200
{
  "data": [
    {
      "id": "txn-uuid-9",
      "amount": -17.99,
      "description": "NETFLIX.COM",
      "merchant": { "id": "merch-uuid-5", "name": "Netflix", "logoUrl": null },
      "categoryId": "SUBSCRIPTIONS",
      "bookedAt": "2026-03-15T00:00:00.000Z"
    }
  ],
  "pagination": { "nextCursor": null, "hasMore": false }
}
```

---

### POST /v1/budgets

```
Request:
POST /v1/budgets
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "categoryId": "DINING",
  "limitAmount": 150.00,
  "period": "MONTHLY",
  "alertAtPercent": 80
}

Response: 201 Created
{
  "id": "budget-uuid-1",
  "categoryId": "DINING",
  "limitAmount": 150.00,
  "period": "MONTHLY",
  "periodStartDay": 1,
  "alertAtPercent": 80,
  "isActive": true,
  "currentSpend": {
    "spentAmount": 0,
    "percentUsed": 0,
    "remainingAmount": 150.00,
    "transactionCount": 0,
    "periodStart": "2026-04-01",
    "periodEnd": "2026-04-30"
  },
  "createdAt": "2026-04-03T10:00:00.000Z"
}
```

---

### GET /v1/budgets

```
Response: 200
{
  "data": [
    {
      "id": "budget-uuid-1",
      "categoryId": "DINING",
      "limitAmount": 150.00,
      "period": "MONTHLY",
      "alertAtPercent": 80,
      "isActive": true,
      "currentSpend": {
        "spentAmount": 89.40,
        "percentUsed": 59.6,
        "remainingAmount": 60.60,
        "transactionCount": 7,
        "periodStart": "2026-04-01",
        "periodEnd": "2026-04-30"
      }
    },
    {
      "id": "budget-uuid-2",
      "categoryId": "TRANSPORT",
      "limitAmount": 80.00,
      "period": "MONTHLY",
      "alertAtPercent": 80,
      "isActive": true,
      "currentSpend": {
        "spentAmount": 72.50,
        "percentUsed": 90.6,
        "remainingAmount": 7.50,
        "transactionCount": 12,
        "periodStart": "2026-04-01",
        "periodEnd": "2026-04-30"
      }
    }
  ]
}
```

---

### GET /v1/recurring

```
Response: 200
{
  "data": [
    {
      "id": "rec-uuid-1",
      "merchantName": "Netflix",
      "merchantId": "merch-uuid-5",
      "averageAmount": -17.99,
      "currency": "EUR",
      "frequency": "MONTHLY",
      "categoryId": "SUBSCRIPTIONS",
      "occurrenceCount": 8,
      "firstSeenAt": "2025-08-15T00:00:00.000Z",
      "lastSeenAt": "2026-03-15T00:00:00.000Z",
      "nextExpectedAt": "2026-04-15T00:00:00.000Z",
      "isActive": true,
      "isDismissed": false
    },
    {
      "id": "rec-uuid-2",
      "merchantName": "Spotify",
      "merchantId": "merch-uuid-6",
      "averageAmount": -10.99,
      "currency": "EUR",
      "frequency": "MONTHLY",
      "categoryId": "SUBSCRIPTIONS",
      "occurrenceCount": 12,
      "firstSeenAt": "2025-04-01T00:00:00.000Z",
      "lastSeenAt": "2026-04-01T00:00:00.000Z",
      "nextExpectedAt": "2026-05-01T00:00:00.000Z",
      "isActive": true,
      "isDismissed": false
    }
  ],
  "summary": {
    "monthlyTotal": 28.98,
    "yearlyEstimate": 347.76,
    "activeCount": 2
  }
}
```

---

### GET /v1/analytics/weekly/current

```
Response: 200
{
  "weekStart": "2026-03-31",
  "weekEnd": "2026-04-06",
  "totalSpent": 247.30,
  "totalEarned": 2100.00,
  "netFlow": 1852.70,
  "transactionCount": 18,
  "topCategoryId": "GROCERIES",
  "topCategoryAmount": 89.50,
  "categoryBreakdown": {
    "GROCERIES": 89.50,
    "DINING": 62.30,
    "TRANSPORT": 45.00,
    "SHOPPING": 32.50,
    "SUBSCRIPTIONS": 18.00
  },
  "comparedToPrevWeekPct": -12.3,
  "insight": "You spent 12% less this week. Groceries was your biggest category."
}
```

---

### GET /v1/analytics/categories

Spending breakdown by category for an arbitrary date range.

```
GET /v1/analytics/categories?from=2026-03-01&to=2026-03-31

Response: 200
{
  "from": "2026-03-01",
  "to": "2026-03-31",
  "totalSpent": 1247.80,
  "categories": [
    { "categoryId": "GROCERIES",     "amount": 342.50, "percent": 27.4, "transactionCount": 14 },
    { "categoryId": "DINING",        "amount": 189.20, "percent": 15.2, "transactionCount": 11 },
    { "categoryId": "BILLS",         "amount": 185.00, "percent": 14.8, "transactionCount": 4 },
    { "categoryId": "TRANSPORT",     "amount": 134.60, "percent": 10.8, "transactionCount": 22 },
    { "categoryId": "SUBSCRIPTIONS", "amount": 127.50, "percent": 10.2, "transactionCount": 6 },
    { "categoryId": "SHOPPING",      "amount": 89.00,  "percent": 7.1,  "transactionCount": 3 },
    { "categoryId": "ENTERTAINMENT", "amount": 65.00,  "percent": 5.2,  "transactionCount": 2 },
    { "categoryId": "HEALTH",        "amount": 55.00,  "percent": 4.4,  "transactionCount": 1 },
    { "categoryId": "OTHER",         "amount": 60.00,  "percent": 4.8,  "transactionCount": 5 }
  ]
}
```

---

### GET /v1/insights

```
Response: 200
{
  "data": [
    {
      "id": "insight-uuid-1",
      "type": "BUDGET_WARNING",
      "title": "Transport budget is almost full",
      "body": "You've spent €72.50 of your €80.00 transport budget (91%). You have €7.50 left this month.",
      "data": {
        "budgetId": "budget-uuid-2",
        "categoryId": "TRANSPORT",
        "spentAmount": 72.50,
        "limitAmount": 80.00,
        "percentUsed": 90.6
      },
      "priority": 8,
      "isRead": false,
      "createdAt": "2026-04-03T08:00:00.000Z"
    },
    {
      "id": "insight-uuid-2",
      "type": "WEEKLY_DIGEST",
      "title": "You spent 12% less this week",
      "body": "€247.30 total, mostly on Groceries (€89.50). That's down from €282.00 last week.",
      "data": {
        "totalSpent": 247.30,
        "topCategoryId": "GROCERIES",
        "comparedToPrevWeekPct": -12.3
      },
      "priority": 5,
      "isRead": false,
      "createdAt": "2026-04-01T08:00:00.000Z"
    }
  ],
  "pagination": { "nextCursor": null, "hasMore": false }
}
```

---

### GET /v1/notifications/settings

```
Response: 200
{
  "weeklyDigest": true,
  "budgetAlerts": true,
  "consentExpiring": true,
  "syncFailed": false,
  "insightCards": true,
  "pushEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

### PATCH /v1/notifications/settings

```
Request:
{
  "weeklyDigest": false,
  "quietHoursStart": "23:00"
}

Response: 200
{
  "weeklyDigest": false,
  "budgetAlerts": true,
  "consentExpiring": true,
  "syncFailed": false,
  "insightCards": true,
  "pushEnabled": true,
  "quietHoursStart": "23:00",
  "quietHoursEnd": "08:00"
}
```

---

## 3. Authentication Approach

### Flow

```
Mobile App                    Supabase Auth               ClearMoney API
    │                              │                           │
    │──── Magic link / OAuth ─────>│                           │
    │<─── JWT (access + refresh) ──│                           │
    │                              │                           │
    │──── POST /v1/auth/register ──┼── Bearer JWT ────────────>│
    │     (first time only)        │                           │── Validate JWT with Supabase
    │                              │                           │── Create user record
    │<─────────────────────────────┼── 201 user object ────────│
    │                              │                           │
    │──── GET /v1/accounts ────────┼── Bearer JWT ────────────>│
    │                              │                           │── Validate JWT
    │                              │                           │── Lookup user by supabase_id
    │                              │                           │── Scope query to user_id
    │<─────────────────────────────┼── 200 accounts ───────────│
```

### Header Format

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Lifecycle

| Token | Issued by | Lifetime | Refresh |
|-------|-----------|----------|---------|
| Access token | Supabase | 1 hour | Auto-refreshed by Supabase client SDK |
| Refresh token | Supabase | 7 days | Stored in expo-secure-store (device keychain) |

### Auth Middleware Behavior

1. Extract `Bearer` token from `Authorization` header
2. Call `supabase.auth.getUser(token)` to validate
3. Lookup `users.supabase_id` → get internal `users.id`
4. Reject if user is soft-deleted (`deleted_at IS NOT NULL`)
5. Set `request.userId` for downstream use

### Which Endpoints Skip Auth

| Path | Why |
|------|-----|
| `GET /health` | Infrastructure probe |
| `GET /health/ready` | Infrastructure probe |
| `POST /v1/auth/register` | Uses Supabase JWT directly (user doesn't exist in our DB yet) |
| `GET /v1/connections/callback` | TrueLayer redirect — carries state param, not JWT |
| `POST /webhooks/truelayer` | External webhook — HMAC signature verification instead |

---

## 4. Error Handling Format

### Error Envelope

Every error response follows this structure:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable explanation for logs and debugging.",
    "details": []
  }
}
```

### Error Codes

| HTTP | Code | When |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Request body/params fail Zod validation |
| 400 | `BAD_REQUEST` | Semantically invalid request (e.g., budget for nonexistent category) |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 401 | `TOKEN_EXPIRED` | JWT expired (client should refresh) |
| 403 | `FORBIDDEN` | User exists but cannot access this resource (not their data) |
| 404 | `NOT_FOUND` | Resource doesn't exist or doesn't belong to user |
| 409 | `CONFLICT` | Duplicate (e.g., budget already exists for this category) |
| 409 | `ALREADY_CONNECTED` | Bank already connected |
| 422 | `CONSENT_EXPIRED` | Bank consent expired, user must re-authenticate |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unhandled server error |
| 502 | `AGGREGATOR_ERROR` | TrueLayer API returned an error |
| 503 | `SERVICE_UNAVAILABLE` | Database or Redis down |

### Validation Error Details

When `code` is `VALIDATION_ERROR`, `details` contains field-level errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      { "field": "limitAmount", "message": "Must be a positive number" },
      { "field": "period", "message": "Must be one of: WEEKLY, FORTNIGHTLY, MONTHLY" }
    ]
  }
}
```

### Error Implementation

All route handlers are wrapped in a centralized error handler that catches Zod errors, Prisma errors, and custom `AppError` instances:

```typescript
// Zod validation failure → 400
// Prisma P2002 (unique constraint) → 409
// Prisma P2025 (record not found) → 404
// AppError → custom status code
// Everything else → 500
```

---

## 5. Pagination, Filtering, and Sorting

### Cursor-Based Pagination

All list endpoints use cursor-based pagination. No offset pagination — it's O(n) and breaks when new data arrives.

```
GET /v1/transactions?limit=20&cursor=eyJib29rZWRBdCI6Li4ufQ==

Response:
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJib29rZWRBdCI6Li4ufQ==",   // base64-encoded composite key
    "hasMore": true
  }
}
```

**Cursor encoding:** The cursor is a base64-encoded JSON object containing the sort key(s) of the last item:

```json
// Decoded cursor for transactions (sorted by booked_at DESC):
{ "bookedAt": "2026-03-25T08:15:00.000Z", "id": "txn-uuid-2" }
```

**Why composite?** `bookedAt` alone isn't unique. Adding `id` as a tiebreaker guarantees stable ordering.

### Filtering

Filters are query parameters. Only whitelisted filters are accepted — others are ignored.

**Transactions:**
| Param | Type | Example | Notes |
|-------|------|---------|-------|
| `accountId` | UUID | `?accountId=acc-uuid-1` | Filter to one account |
| `categoryId` | TEXT | `?categoryId=DINING` | Filter by category |
| `from` | ISO datetime | `?from=2026-03-01T00:00:00Z` | Inclusive lower bound on `booked_at` |
| `to` | ISO datetime | `?to=2026-03-31T23:59:59Z` | Exclusive upper bound on `booked_at` |
| `isPending` | boolean | `?isPending=true` | Pending transactions only |
| `minAmount` | number | `?minAmount=-50` | Absolute amount filter |
| `maxAmount` | number | `?maxAmount=-10` | Absolute amount filter |
| `limit` | integer | `?limit=20` | 1–100, default 50 |
| `cursor` | string | `?cursor=eyJ...` | Pagination cursor |

**Budgets:** No filters needed — always returns all active budgets for the user.

**Recurring payments:**
| Param | Type | Example |
|-------|------|---------|
| `isActive` | boolean | `?isActive=true` (default) |
| `frequency` | TEXT | `?frequency=MONTHLY` |

**Notifications:**
| Param | Type | Example |
|-------|------|---------|
| `isRead` | boolean | `?isRead=false` |
| `type` | TEXT | `?type=BUDGET_ALERT` |

### Sorting

Transactions: Always sorted by `booked_at DESC` (newest first). No custom sorting — this is the only access pattern that makes sense for a transaction feed and it matches our indexes.

Budgets: Sorted by `category_id` (alphabetical) — gives a consistent order.

Recurring: Sorted by `average_amount DESC` (most expensive first) — highlights the biggest charges.

Insights: Sorted by `priority DESC, created_at DESC` — important items first.

Notifications: Sorted by `created_at DESC` — newest first.

---

## 6. Controller / Service Structure

### Architecture

```
Route Handler (thin) → Service (business logic) → Repository (Prisma)
```

Route handlers validate input and format output. Services contain business logic. Prisma is the repository layer. No separate repository abstraction — Prisma already provides that.

### File Layout

```
apps/api/src/
  routes/                      ← Route handlers (thin controllers)
    health.ts                  ← GET /health, GET /health/ready
    auth.ts                    ← POST /auth/register, GET/PATCH/DELETE /auth/me
    institutions.ts            ← GET /institutions
    connections.ts             ← CRUD /connections
    accounts.ts                ← GET /accounts, POST /accounts/:id/sync
    transactions.ts            ← GET/PATCH /transactions
    budgets.ts                 ← CRUD /budgets
    recurring.ts               ← GET /recurring, PATCH dismiss
    analytics.ts               ← GET /analytics/weekly, categories
    insights.ts                ← GET /insights, PATCH read
    notifications.ts           ← GET /notifications, settings
    sync.ts                    ← GET /sync/status
    categories.ts              ← GET /categories
    webhooks.ts                ← POST /webhooks/truelayer

  services/                    ← Business logic
    auth.service.ts            ← Register, profile, deletion, export
    connection.service.ts      ← TrueLayer OAuth, token management
    sync.service.ts            ← Transaction sync orchestration
    categorisation.service.ts  ← Merchant matching, override logic
    budget.service.ts          ← Budget CRUD + spend computation
    recurring.service.ts       ← Recurring payment detection
    analytics.service.ts       ← Weekly summary computation
    insight.service.ts         ← Insight generation
    notification.service.ts    ← Push notification dispatch
    truelayer.service.ts       ← TrueLayer API client
    encryption.service.ts      ← AES-256-GCM encrypt/decrypt

  plugins/                     ← Fastify plugins (cross-cutting)
    prisma.ts                  ← DB connection lifecycle
    auth.ts                    ← JWT validation middleware
    error-handler.ts           ← Centralized error formatting
    rate-limit.ts              ← Per-route rate limiting

  jobs/                        ← BullMQ job definitions
    queues.ts                  ← Queue declarations
    workers/                   ← Job handlers

  config/
    env.ts                     ← Zod-validated environment variables
```

### Example: Route → Service → Prisma

```typescript
// routes/budgets.ts (thin — validation + delegation)
app.post('/', async (request, reply) => {
  const input = CreateBudgetSchema.parse(request.body);
  const budget = await budgetService.create(request.userId, input);
  return reply.code(201).send(budget);
});

// services/budget.service.ts (business logic)
async create(userId: string, input: CreateBudget) {
  // Check category exists
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError(400, 'BAD_REQUEST', 'Category not found');

  // Check no existing active budget for this category
  const existing = await prisma.budget.findFirst({
    where: { userId, categoryId: input.categoryId, isActive: true },
  });
  if (existing) throw new AppError(409, 'CONFLICT', 'Budget already exists for this category');

  // Create the budget
  const budget = await prisma.budget.create({
    data: { ...input, userId },
  });

  // Compute current spend for the response
  const currentSpend = await this.computeCurrentSpend(userId, budget);

  return { ...budget, currentSpend };
}
```

---

## 7. Validation Rules

All validation uses Zod schemas from `@clearmoney/shared`. Validated in route handlers before hitting services.

### Auth / User

| Field | Rules |
|-------|-------|
| `displayName` | Optional. String, 1–100 chars. No leading/trailing whitespace. |
| `timezone` | Optional. Must be valid IANA timezone (e.g., `Europe/Dublin`). |
| `currency` | Optional. Must be ISO 4217 code. Currently only `EUR` supported. |

### Connections

| Field | Rules |
|-------|-------|
| `institutionId` | Required. Must exist in `institutions` table and be `is_available = true`. |

### Transactions

| Field | Rules |
|-------|-------|
| `categoryId` (update) | Required. Must be one of the 12 valid category IDs. |

### Budgets

| Field | Rules |
|-------|-------|
| `categoryId` | Required. Must be a valid category ID. Must be an expense category (`is_expense = true`). Cannot already have an active budget. |
| `limitAmount` | Required. Positive number. Max 999999.99. |
| `period` | Required. One of: `WEEKLY`, `FORTNIGHTLY`, `MONTHLY`. |
| `periodStartDay` | Optional. Integer 1–28. Default 1. For MONTHLY: day of month. For WEEKLY: 1=Monday. |
| `alertAtPercent` | Optional. Integer 1–100. Default 80. |

### Notifications Settings

| Field | Rules |
|-------|-------|
| `weeklyDigest` | Boolean |
| `budgetAlerts` | Boolean |
| `consentExpiring` | Boolean |
| `syncFailed` | Boolean |
| `insightCards` | Boolean |
| `pushEnabled` | Boolean |
| `quietHoursStart` | String, HH:MM format, 24-hour |
| `quietHoursEnd` | String, HH:MM format, 24-hour |

### Query Parameters (Pagination/Filtering)

| Field | Rules |
|-------|-------|
| `limit` | Integer, 1–100, default 50 |
| `cursor` | Base64-encoded string. Decoded and validated server-side. If invalid, ignored (treated as first page). |
| `from` / `to` | ISO 8601 datetime string. `from` must be before `to`. Max range: 1 year. |
| `accountId` | UUID format |
| `categoryId` | Must be a valid category ID |

---

## 8. Versioning Strategy

### URL-Based Versioning

```
/v1/transactions
/v1/budgets
/v2/transactions    ← (future, if breaking changes needed)
```

**Why URL versioning over headers?**
- Visible and obvious — no hidden version negotiation
- Easy to test with curl/browser
- Mobile app can pin to a version and upgrade on their own schedule
- Multiple versions can coexist behind the same load balancer

### Version Lifecycle

| Phase | Duration | Behavior |
|-------|----------|----------|
| Active | Indefinite | Current version. All new features land here. |
| Deprecated | 6 months minimum | Still functional. Response includes `Deprecation` header. |
| Sunset | After deprecation | Returns `410 Gone` with message directing to new version. |

### When to Bump Versions

Bump to `/v2` only for **breaking changes**:
- Removing a field from a response
- Changing a field's type
- Changing URL structure
- Changing error code semantics

**Non-breaking changes** (no version bump needed):
- Adding new fields to responses
- Adding new endpoints
- Adding new optional query parameters
- Adding new error codes
- Relaxing validation (accepting more input)

### Deprecation Header

```
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: <https://api.clearmoney.app/v2/transactions>; rel="successor-version"
```

### Implementation

Routes are registered under a version prefix in app.ts:

```typescript
// All v1 routes under /v1 prefix
await app.register(async (v1) => {
  await v1.register(authRoutes, { prefix: '/auth' });
  await v1.register(accountRoutes, { prefix: '/accounts' });
  // ...
}, { prefix: '/v1' });

// Health + webhooks stay unversioned (infrastructure, not API contract)
await app.register(healthRoutes, { prefix: '/health' });
await app.register(webhookRoutes, { prefix: '/webhooks' });
```

---

## Summary: Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Pagination | Cursor-based | Stable under concurrent writes, O(1) for any page depth, matches our DESC index |
| Auth | Supabase JWT → internal user lookup | Decouples auth provider from data model. Internal UUIDs never leak to Supabase. |
| Error format | `{ error: { code, message, details } }` | Machine-parseable `code` for client logic, human `message` for debugging |
| Versioning | URL prefix `/v1/` | Explicit, cacheable, easy to route at load balancer level |
| Sorting | Fixed per-resource | Matches our indexes. Custom sort orders would need new indexes per combination. |
| Response format | Named data key + pagination | Self-documenting. Client knows if response is a list or single item. |
| Validation | Shared Zod schemas | Single source of truth. Same schema validates on client before send and server on receive. |
| Budget current spend | Computed on read | Budget limits rarely change. Spend changes every sync. Computing on read from transactions avoids stale cached values. |
