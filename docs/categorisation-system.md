# Transaction Categorisation System

## Overview

Every transaction that enters ClearMoney goes through a categorisation pipeline that assigns a category, cleans up the merchant name, detects income/transfers, and identifies recurring payments. The pipeline runs during sync (background) and is invisible to the user — they just see clean, labelled transactions.

## 1. Category Model

12 categories, fixed at the app level. Users cannot create custom categories — this is intentional. Fewer categories means simpler budgeting, cleaner analytics, and a consistent experience.

| ID | Label | Type | Purpose |
|---|---|---|---|
| `GROCERIES` | Groceries | expense | Supermarkets, food shops |
| `DINING` | Dining & Takeaway | expense | Restaurants, takeaways, coffee |
| `TRANSPORT` | Transport | expense | Rides, fuel, public transit, parking |
| `ENTERTAINMENT` | Entertainment | expense | Cinema, events, gaming |
| `SHOPPING` | Shopping | expense | Clothes, electronics, general retail |
| `BILLS` | Bills & Utilities | expense | Rent, electricity, gas, water, internet |
| `HEALTH` | Health & Fitness | expense | Gym, pharmacy, doctor |
| `SUBSCRIPTIONS` | Subscriptions | expense | Streaming, SaaS, recurring digital |
| `TRANSFERS` | Transfers | non-expense | Between own accounts, to other people |
| `INCOME` | Income | non-expense | Salary, refunds, government payments |
| `ATM` | Cash & ATM | expense | ATM withdrawals |
| `OTHER` | Other | expense | Fallback for unmatched transactions |

### Why fixed categories?

- Budgets, analytics, and insights all depend on a stable category set
- Users can re-categorise individual transactions (override), but the set itself doesn't change
- 12 categories is the sweet spot: enough to be useful, few enough to not overwhelm

## 2. Categorisation Pipeline

Every transaction runs through these stages **in order**. The first stage that produces a match wins.

```
Transaction from provider
  │
  ├── Stage 1: User override check
  │   Does this user have a MerchantOverride for this merchant?
  │   → YES: use the user's preferred category. Confidence: 1.0
  │
  ├── Stage 2: Known merchant match
  │   Does the description match any merchant.rawPatterns?
  │   → YES: use merchant.defaultCategoryId. Confidence: 0.9
  │
  ├── Stage 3: Income detection
  │   Is amount > 0 and does description match income heuristics?
  │   → YES: INCOME. Confidence: 0.7–0.95
  │
  ├── Stage 4: Transfer detection
  │   Does description match transfer patterns?
  │   → YES: TRANSFERS. Confidence: 0.7–0.9
  │
  ├── Stage 5: ATM detection
  │   Does description contain ATM patterns?
  │   → YES: ATM. Confidence: 0.95
  │
  ├── Stage 6: Keyword rules
  │   Does description match any keyword → category rules?
  │   → YES: matched category. Confidence: 0.5–0.7
  │
  └── Stage 7: Fallback
      → OTHER. Confidence: 0.0
```

### Why this order?

- User overrides always win (they explicitly chose this)
- Known merchants are highly reliable (curated patterns)
- Income/transfer/ATM detection before keyword rules because they have structural signals (amount sign, specific bank formats)
- Keyword rules are the fuzziest — lowest priority
- Fallback to OTHER is safe — the user can always correct it

## 3. Merchant Normalisation

Bank descriptions are messy:
```
"POS TESCO STORES 3219 DUBLIN IE"
"VDP-UBER *TRIP HELP.UBER.COM NL"
"DD NETFLIX.COM 800-123-456"
"FT FROM JOHN SMITH REF 12345"
```

### Normalisation steps

```
Raw description
  │
  ├── 1. Strip transaction type prefixes
  │   Remove: POS, VDP, DD, STO, FT, BGC, DEB, BP, TFR
  │   "POS TESCO STORES 3219 DUBLIN IE" → "TESCO STORES 3219 DUBLIN IE"
  │
  ├── 2. Strip trailing location/reference data
  │   Remove: country codes (2-letter at end), city names, numeric refs
  │   "TESCO STORES 3219 DUBLIN IE" → "TESCO STORES"
  │
  ├── 3. Strip card numbers and dates
  │   Remove: *1234, xx1234, dates like 01/02, reference numbers
  │   "UBER *TRIP HELP.UBER.COM" → "UBER TRIP"
  │
  ├── 4. Collapse whitespace
  │   "TESCO  STORES" → "TESCO STORES"
  │
  └── 5. Match against merchants table
      Try rawPatterns (ILIKE): "TESCO STORES" matches '%TESCO%'
      → Merchant: "Tesco"
      → Clean display name replaces raw description
```

### What the user sees

| Raw from bank | After normalisation |
|---|---|
| `POS TESCO STORES 3219 DUBLIN IE` | **Tesco** |
| `VDP-UBER *TRIP HELP.UBER.COM NL` | **Uber** |
| `DD NETFLIX.COM 800-123-456` | **Netflix** |
| `STO ELECTRIC IRELAND DD 30APR` | **Electric Ireland** |
| `POS PENNEYS LIFFEY VLY DUBLIN` | **Penneys** |
| `FT FROM JOHN SMITH REF 12345` | *From John Smith* (no merchant match — shown as-is after prefix strip) |

## 4. Income Detection Heuristics

Income is detected by **amount sign + description patterns**. Both must match.

### Rules (ordered by confidence)

| Signal | Pattern | Confidence | Category |
|---|---|---|---|
| Salary keywords | `SALARY`, `WAGES`, `PAYROLL`, `PAY FROM` + amount > €500 | 0.95 | INCOME |
| Employer name recurrence | Same payer, monthly, amount > €500, consistent timing | 0.90 | INCOME |
| Government payments | `DEPT SOCIAL`, `DSP `, `REVENUE REFUND`, `TAX REFUND` | 0.90 | INCOME |
| Refunds | `REFUND`, `REVERSAL`, `CREDIT` + amount > 0 + amount < €200 | 0.75 | INCOME |
| Generic credit | Amount > 0 + no other match + amount > €100 | 0.50 | INCOME |
| Small credit | Amount > 0 + amount < €20 | 0.30 | OTHER (probably P2P, not income) |

### Why the amount threshold?

A €2.50 refund from Tesco isn't "income" — it's noise. The €500 salary threshold catches most Irish salaries while excluding random credits. The system errs toward **not labelling** something as income rather than mis-labelling.

## 5. Transfer Detection Heuristics

Transfers between own accounts or to/from other people.

| Signal | Pattern | Confidence |
|---|---|---|
| Internal transfer | `TFR`, `TRANSFER TO`, `TRANSFER FROM` + matching account holder name | 0.90 |
| Standing order to self | Description references user's other account number | 0.85 |
| P2P keywords | `REVOLUT`, `PAYPAL`, `SENT TO`, `FROM ` (person name) | 0.70 |
| Generic transfer | `FT `, `FASTER PAYMENT`, `SEPA CREDIT` + amount > 0 | 0.60 |

### Transfer vs Income disambiguation

If amount > 0 and description matches **both** transfer and income patterns, prefer:
- INCOME if salary/payroll keywords present
- TRANSFERS if own-account reference detected
- INCOME if amount > €500 and recurring monthly
- TRANSFERS otherwise (safer default — user can correct)

## 6. Recurring Payment Detection

Runs as a **post-processing step** after transactions are synced. Not part of the per-transaction categorisation pipeline.

### Algorithm

```
For each user, group transactions by merchantId (or normalised description if no merchant):
  │
  ├── Filter: at least 3 occurrences in the last 180 days
  ├── Filter: amounts within 20% of each other (tolerance for price changes)
  │
  ├── Compute intervals between consecutive transactions (days)
  ├── Classify frequency:
  │   ├── avg 6–8 days   → WEEKLY
  │   ├── avg 13–16 days → FORTNIGHTLY
  │   ├── avg 27–34 days → MONTHLY
  │   ├── avg 85–100 days → QUARTERLY
  │   └── avg 350–380 days → YEARLY
  │   └── else → not recurring (skip)
  │
  ├── Compute: averageAmount, firstSeenAt, lastSeenAt, occurrenceCount
  ├── Predict: nextExpectedAt = lastSeenAt + avgInterval
  │
  └── Upsert into recurring_payments table
      (deduplicated by userId + merchantId/merchantName)
```

### Bills vs Subscriptions

| Signal | Classification |
|---|---|
| `merchant.isSubscription = true` | SUBSCRIPTIONS |
| Amount varies (utility meters) | BILLS |
| Fixed amount + digital merchant | SUBSCRIPTIONS |
| Fixed amount + utilities/telecom | BILLS |
| Default for unknown recurring | BILLS |

### Missed payment detection

If `nextExpectedAt` has passed by more than `avgInterval * 0.5`:
- If the payment source was a subscription → create insight: "Your {name} subscription may have been cancelled"
- If it was a bill → don't alert (bills can vary in timing)

## 7. Override System

### How it works

1. User taps a transaction → changes category from SHOPPING to GROCERIES
2. API: update `transaction.categoryId = 'GROCERIES'`
3. API: upsert `merchant_overrides` row: `(userId, merchantId) → categoryId`
4. Next sync: when this merchant appears again, Stage 1 of the pipeline finds the override → applies GROCERIES automatically

### Override priority chain

```
1. merchant_overrides (per-user)     ← highest priority, user explicitly chose this
2. merchants.default_category_id     ← global default, curated
3. keyword rules                     ← heuristic match
4. OTHER                             ← fallback
```

### What "learning from overrides" means

It's **per-user, per-merchant, explicit learning** — not ML. When a user re-categorises a Tesco transaction to DINING (maybe they only buy ready meals), all future Tesco transactions for **that user only** become DINING. Other users still see GROCERIES.

This is the right approach for an MVP because:
- It's deterministic and debuggable
- Users understand it ("I changed it and it remembered")
- No cold start problem, no training data needed
- Scales to millions of users (one DB row per override)

### Bulk re-categorisation

When a user creates an override, optionally back-apply to recent transactions:
```sql
UPDATE transactions
SET category_id = :newCategoryId
WHERE user_id = :userId
  AND merchant_id = :merchantId
  AND category_id = :oldCategoryId
  AND booked_at > NOW() - INTERVAL '90 days';
```

## 8. Confidence Scoring

Every categorisation result carries a confidence score (0.0–1.0). This is **not shown to the user** — it's used internally to:

1. Decide whether to show a "Is this right?" prompt on new merchants
2. Prioritise which transactions to show in a "Help us learn" review screen
3. Track categorisation quality over time (monitoring)

| Source | Confidence |
|---|---|
| User override (MerchantOverride) | 1.00 |
| Known merchant (rawPatterns match) | 0.90 |
| ATM pattern | 0.95 |
| Salary pattern + high amount | 0.95 |
| Income keyword | 0.75 |
| Transfer keyword | 0.70 |
| Keyword category rule | 0.50–0.70 |
| Generic credit/debit fallback | 0.30 |
| No match (OTHER) | 0.00 |

### How confidence improves over time

- More merchant patterns added → fewer Stage 6/7 hits
- User overrides accumulate → more Stage 1 hits (confidence 1.0)
- Admin curation of merchant table → better Stage 2 matches
- Category accuracy metric: `1 - (overrides / total_transactions)` per period

## Summary: What Makes This Production-Ready

1. **Deterministic pipeline** — no ML, no black box, fully debuggable
2. **User corrections stick** — override once, remembered forever
3. **Merchant normalisation** — users see clean names, not bank gibberish
4. **Irish context** — seed data covers Tesco, Dunnes, AIB, BOI, Revenue, Bord Gáis, Leap, etc.
5. **Graceful degradation** — unmatched transactions get OTHER, not a wrong guess
6. **Confidence scoring** — internal quality signal without confusing users
7. **Recurring detection** — automatic, based on timing + amount patterns
8. **Provider-agnostic** — works with any transaction source (the pipeline takes normalised `ProviderTransaction`, not TrueLayer-specific data)
