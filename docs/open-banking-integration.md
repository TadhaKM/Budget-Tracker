# Open Banking Integration Layer

## 1. Integration Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        ClearMoney API                            │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │  Routes   │→│  SyncService │→│  BankingProvider (adapter)   │ │
│  │ (HTTP)    │  │ (orchestrate)│  │  ┌────────────────────────┐ │ │
│  └──────────┘  └──────┬───────┘  │  │  TrueLayerProvider     │ │ │
│                       │          │  │  (concrete impl)        │ │ │
│  ┌──────────┐         │          │  └────────────────────────┘ │ │
│  │ Webhooks  │→┌──────┴───────┐  │  ┌────────────────────────┐ │ │
│  │ (HTTP)    │ │   BullMQ     │  │  │  MockProvider          │ │ │
│  └──────────┘ │   Workers     │  │  │  (testing)             │ │ │
│               └──────────────┘  │  └────────────────────────┘ │ │
│                                  └────────────────────────────┘ │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  CryptoUtil   │  │  TokenManager │  │  ConsentTracker     │   │
│  │  (AES-256)    │  │  (refresh)    │  │  (expiry/status)    │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Adapter pattern**: All open banking calls go through a `BankingProvider` interface. The app never calls TrueLayer directly.
2. **Encrypted token storage**: Access/refresh tokens encrypted at rest with AES-256-GCM. Decrypted only in-memory during sync.
3. **Background sync**: All data fetching happens in BullMQ workers, never in HTTP request handlers.
4. **Idempotent upserts**: Transactions keyed by `externalTransactionId`. Re-syncing the same data is safe.
5. **Consent lifecycle**: Consent status tracked as a state machine (PENDING → ACTIVE → EXPIRED/REVOKED).

## 2. Provider Adapter Design

The `BankingProvider` interface is the only contract between ClearMoney and any aggregator:

```typescript
interface BankingProvider {
  // OAuth consent flow
  getAuthUrl(params: AuthUrlParams): string;
  exchangeCode(code: string): Promise<TokenPair>;
  refreshTokens(refreshToken: string): Promise<TokenPair>;

  // Data fetching
  getAccounts(accessToken: string): Promise<ProviderAccount[]>;
  getBalance(accessToken: string, accountId: string): Promise<ProviderBalance>;
  getTransactions(accessToken: string, accountId: string, opts: DateRange): Promise<ProviderTransaction[]>;

  // Webhooks
  verifyWebhookSignature(payload: Buffer, signature: string): boolean;
  parseWebhookEvent(payload: unknown): WebhookEvent;
}
```

**Why an interface?** TrueLayer is the provider today, but PSD2 regulations evolve, providers merge, and testing needs a mock. The adapter costs almost nothing and saves a rewrite later.

Swapping providers means: implement a new class, change one factory function, migrate stored tokens (one-time script). No route, service, or worker code changes.

## 3. Domain Models (Provider-Agnostic)

These are the normalised shapes that cross the adapter boundary. The adapter maps vendor-specific JSON into these:

```typescript
// What the adapter returns (vendor-neutral)
interface ProviderAccount {
  externalId: string;          // vendor's account ID
  accountType: string;         // CURRENT | SAVINGS | CREDIT_CARD
  displayName: string;
  currency: string;
  accountNumber?: { iban?: string; sortCode?: string; number?: string };
}

interface ProviderBalance {
  current: number;             // always in minor-unit-safe string internally
  available?: number;
  currency: string;
  updatedAt: string;           // ISO 8601
}

interface ProviderTransaction {
  externalId: string;          // vendor's transaction ID
  amount: number;              // negative = outgoing, positive = incoming
  currency: string;
  description: string;
  merchantName?: string;
  category?: string;           // vendor's category hint (we re-categorise)
  isPending: boolean;
  bookedAt: string;            // ISO 8601
}

// Consent/token management
interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;           // seconds
  scope: string;
}

// Webhook events
interface WebhookEvent {
  type: 'SYNC_AVAILABLE' | 'CONSENT_REVOKED' | 'CONSENT_EXPIRING' | 'ERROR';
  connectionExternalId?: string;
  accountExternalId?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}
```

## 4. Webhook Processing Flow

```
TrueLayer POST /webhooks/truelayer
  │
  ├── 1. Verify HMAC signature (reject if invalid)
  ├── 2. Return 200 immediately (< 500ms)
  ├── 3. Enqueue to sync:webhook BullMQ queue
  │
  └── Worker picks up job:
      ├── Parse event via provider.parseWebhookEvent()
      ├── Route by event type:
      │   ├── SYNC_AVAILABLE → enqueue full account sync
      │   ├── CONSENT_REVOKED → mark connection REVOKED, deactivate accounts
      │   ├── CONSENT_EXPIRING → create notification + insight card
      │   └── ERROR → log, create sync job with error, alert if repeated
      └── Record in audit_log
```

### Why async?
Webhook endpoints MUST respond fast. TrueLayer retries on timeout. Doing DB work or downstream calls inline risks 5xx → retry storm.

## 5. Sync Job Strategy

### Job Types

| Job Type | Trigger | What It Does |
|---|---|---|
| `INITIAL_SYNC` | OAuth callback | Fetch all accounts, 90 days of transactions, balances |
| `INCREMENTAL_SYNC` | Webhook / scheduled | Fetch transactions since lastSyncedAt, update balances |
| `BALANCE_ONLY` | Scheduled (hourly) | Fetch balances only — lightweight |
| `RE_AUTH` | Consent expiring | Prompt user, don't sync until renewed |

### Sync Orchestration (per connection)

```
SyncService.syncConnection(connectionId)
  │
  ├── 1. Load connection + decrypt tokens
  ├── 2. Check consent status (abort if EXPIRED/REVOKED)
  ├── 3. Refresh access token if expired
  │     └── If refresh fails → mark EXPIRED, create notification, abort
  ├── 4. Re-encrypt new tokens, update DB
  ├── 5. Fetch accounts from provider
  │     └── Upsert accounts (match on externalAccountId)
  │     └── Deactivate accounts no longer returned
  ├── 6. For each active account:
  │     ├── Fetch balance → insert Balance row
  │     └── Fetch transactions (since lastSyncedAt or 90 days)
  │         ├── Match merchant via rawPatterns → assign merchantId
  │         ├── Apply user's category overrides
  │         └── Upsert transactions (match on externalTransactionId)
  ├── 7. Update connection.lastSyncedAt
  ├── 8. Update SyncJob (status, transactionsSynced, completedAt)
  └── 9. Detect recurring payments (post-processing)
```

### Retry Policy

```
Attempt 1: immediate
Attempt 2: 5s delay (exponential backoff)
Attempt 3: 25s delay
Attempt 4: 125s delay (final)

After 4 failures:
  → Mark SyncJob as FAILED
  → Create notification: "We couldn't sync your {bank} account"
  → Set connection.consentStatus = 'ERROR' if auth-related
```

### Deduplication
- BullMQ job ID = `sync:${connectionId}:${jobType}` — prevents duplicate sync jobs for the same connection
- Transactions matched on `externalTransactionId` (unique constraint) — upsert is always safe

## 6. Error Cases

| Error | Detection | Response |
|---|---|---|
| **Access token expired** | 401 from provider | Auto-refresh via `refreshTokens()` and retry once |
| **Refresh token expired** | 401 on refresh call | Mark connection EXPIRED, notify user to re-auth |
| **Consent revoked by user at bank** | Webhook or 403 | Mark REVOKED, deactivate accounts, notify |
| **Consent approaching expiry** | Daily cron checks `consentExpiresAt` | Notify 7 days and 1 day before expiry |
| **Rate limited by provider** | 429 response | Respect `Retry-After` header, re-enqueue with delay |
| **Provider downtime** | 5xx / timeout | Retry with backoff. After max attempts → FAILED job |
| **Duplicate transaction** | Prisma P2002 on unique | Skip (idempotent upsert handles this) |
| **Account removed at bank** | Account missing from provider response | Mark `isActive: false`, keep history |
| **Partial sync failure** | One account fails, others succeed | Continue other accounts, mark failed ones in job metadata |
| **Encryption key rotation** | Ops procedure | Re-encrypt all tokens in a migration script |

## 7. Keeping It Provider-Agnostic

### What IS coupled to TrueLayer
- `TrueLayerProvider` class (one file)
- Webhook signature verification (HMAC secret)
- OAuth URL parameters (scopes, provider IDs)
- Token exchange endpoint format

### What is NOT coupled
- All routes, services, workers, and domain models
- Sync orchestration logic
- Error handling and retry strategy
- Token encryption/storage
- Merchant matching and categorisation

### Switching Providers Checklist
1. Implement new `BankingProvider` class
2. Update `createBankingProvider()` factory
3. Write a token migration script (one-time)
4. Update institution seed data
5. Update webhook endpoint signature verification
6. No changes to: routes, SyncService, workers, mobile app

## 8. Scheduled Jobs

| Schedule | Job | Purpose |
|---|---|---|
| Every 4 hours | `INCREMENTAL_SYNC` per active connection | Catch transactions between webhooks |
| Every hour | `BALANCE_ONLY` per active connection | Keep balances fresh |
| Daily 02:00 | Consent expiry check | Notify users of approaching expiry |
| Weekly Monday 03:00 | Weekly summary computation | Pre-compute analytics |
| Daily 04:00 | Recurring payment detection | Update subscription tracking |
