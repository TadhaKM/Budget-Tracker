# ClearMoney — 12-Week MVP Roadmap

Solo developer building a mobile-first personal finance app for the Irish market. Connects to AIB, BOI, PTSB via TrueLayer open banking. Read-only — not a bank.

---

## Current State (Week 0)

Already built:

| Layer | What exists |
|-------|-------------|
| Database | 17 Prisma models across 5 domains (identity, banking, categorisation, analytics, operations) |
| API | 14 route files, 8 services, 4 BullMQ workers, cron scheduler, rate limiting, security headers |
| Mobile | 15 screens, 20 components (12 UI + 8 finance), 7 hooks, 4 stores, typed API client |
| Shared | Zod schemas, category constants, TypeScript types |
| Infra | Turborepo monorepo, Supabase auth, encrypted token storage, webhook verification |
| Docs | Architecture, API design, categorisation, analytics, UX, component plan, security checklist |

What's NOT done yet: end-to-end integration, real TrueLayer sandbox testing, deployment, polish, testing.

---

## Feature Dependencies

```
Supabase Auth ──► Onboarding ──► Account Linking ──► First Sync
                                                        │
                               ┌────────────────────────┤
                               ▼                        ▼
                          Balances              Transactions
                               │                        │
                               │              ┌─────────┼──────────┐
                               │              ▼         ▼          ▼
                               │      Categorisation  Search   Recurring
                               │              │                Detection
                               │              ▼
                               │      Weekly Summaries
                               │              │
                               ├──────────────┤
                               ▼              ▼
                           Budgets        Analytics
                               │              │
                               └──────┬───────┘
                                      ▼
                                  Insights
                                      │
                                      ▼
                               Notifications
```

**Critical path:** Auth → Link → Sync → Transactions → Categorisation → Summaries → Dashboard

Everything else branches off this spine.

---

## Priority Order (P0 → P3)

| Priority | Feature | Why |
|----------|---------|-----|
| **P0** | Auth + onboarding | Can't do anything without users |
| **P0** | Account linking (TrueLayer OAuth) | Core value proposition |
| **P0** | Sync + balances + transactions | Users must see their money |
| **P0** | Transaction categorisation | Raw bank data is unreadable |
| **P1** | Home dashboard | First thing users see |
| **P1** | Transaction list + search | Daily use case |
| **P1** | Weekly summaries | Key differentiator — "your money, explained" |
| **P1** | Budgets | Users asked for spending limits |
| **P2** | Recurring payment detection | Automated, runs post-sync |
| **P2** | Analytics screen | Month-to-date, category breakdown, merchants |
| **P2** | Insight cards | Plain-English nudges |
| **P2** | Notifications | Budget alerts, weekly digest, consent expiry |
| **P3** | Settings polish | Export, notification prefs, app info |
| **P3** | Consent re-auth flow | Needed at 90 days, not day 1 |

---

## Weekly Plan

### Week 1 — Auth & Environment

**Goal:** User can sign up, sign in, and reach the home screen.

- [ ] Deploy Supabase project, configure magic link email template
- [ ] Deploy PostgreSQL (Railway / Supabase DB / Neon)
- [ ] Run `prisma migrate deploy` against production DB
- [ ] Run seed script (categories, institutions, merchants)
- [ ] Deploy API to Railway/Render, verify `/health/ready`
- [ ] Set up Redis (Upstash or Railway)
- [ ] Test mobile auth flow end-to-end: onboarding → magic link → tabs
- [ ] Fix any deep link issues with `clearmoney://` scheme

**Milestone: "Golden path" — new user lands on empty home screen**

---

### Week 2 — Account Linking

**Goal:** User can connect a bank account through TrueLayer sandbox.

- [ ] Register TrueLayer sandbox app, get client credentials
- [ ] Configure redirect URI (deep link back to app)
- [ ] Test full OAuth flow: app → TrueLayer auth → bank selection → redirect → callback
- [ ] Verify token exchange, encryption, and storage
- [ ] Handle OAuth error states (user denies, timeout, invalid state)
- [ ] Show connected bank in settings screen
- [ ] Add "Connect Bank" CTA on empty home screen

**Milestone: "Bank connected" — user sees their bank listed in settings**

---

### Week 3 — First Sync & Balances

**Goal:** After linking, user sees real account balances.

- [ ] Trigger initial sync after successful OAuth callback
- [ ] Verify SyncService flow: refresh token → fetch accounts → upsert → fetch balances
- [ ] Display real balances on BalanceCard (home screen)
- [ ] Show individual accounts on settings screen with AccountCard
- [ ] Add account detail screen showing balance and bank name
- [ ] Handle sync errors gracefully (show retry UI, not crash)
- [ ] Wire up manual "Sync now" button on account detail

**Milestone: "Real money" — user sees their actual bank balance**

---

### Week 4 — Transactions

**Goal:** User sees a real transaction feed, categorised.

- [ ] Verify transaction sync (90-day initial window)
- [ ] Test categorisation pipeline against real TrueLayer sandbox transactions
- [ ] Tune merchant normaliser for Irish bank description formats
- [ ] Wire TransactionRow to real data (merchant name, amount, category icon)
- [ ] Implement grouped-by-day display on transactions screen
- [ ] Implement infinite scroll (cursor pagination)
- [ ] Build transaction detail screen with real data
- [ ] Test category filter chips

**Milestone: "The feed works" — scrollable, categorised transaction history**

---

### Week 5 — Category Overrides & Search

**Goal:** User can fix wrong categories. Search works.

- [ ] Wire category picker on transaction detail (PATCH endpoint)
- [ ] Verify MerchantOverride creation — future transactions from same merchant auto-categorise
- [ ] Show confidence indicator if categorisation was uncertain
- [ ] Implement transaction search (GET /transactions/search)
- [ ] Add search bar to transactions screen
- [ ] Test edge cases: duplicate transactions, pending → booked, refunds

**Milestone: "User control" — override a category, see it stick on next sync**

---

### Week 6 — Weekly Summaries & Dashboard

**Goal:** Home screen shows real weekly spending data.

- [ ] Wire SummaryCard to live `computeCurrentWeek()` data
- [ ] Test weekly summary computation (spent, earned, top category)
- [ ] Wire dashboard endpoint — 7 parallel computations
- [ ] Connect BalanceCard, SummaryCard, budget progress, upcoming bills to real dashboard data
- [ ] Add pull-to-refresh that triggers sync + refetch
- [ ] Verify loading skeletons and empty states render correctly
- [ ] Fix any data formatting issues (currency, dates, percentages)

**Milestone: "Smart home screen" — dashboard shows real financial picture**

---

### Week 7 — Budgets

**Goal:** User can create budgets and track spending against them.

- [ ] Wire budget create screen to POST /budgets
- [ ] Wire budget list to GET /budgets with real spend calculation
- [ ] Wire BudgetProgressBar with live data (spent vs limit, percentage)
- [ ] Wire budget detail screen with delete
- [ ] Show budget progress on home dashboard
- [ ] Test month boundary edge case (budget resets)
- [ ] Test "over budget" state styling

**Milestone: "Spending limits" — user sets a grocery budget, sees progress**

---

### Week 8 — Recurring Payments & Notifications

**Goal:** App detects subscriptions. Budget alerts work.

- [ ] Verify RecurringDetector runs post-sync (3+ occurrences, interval classification)
- [ ] Wire recurring payments screen with real data (split subs vs bills)
- [ ] Show monthly total calculation
- [ ] Wire notify:budget worker — budget warning at 80%, exceeded at 100%
- [ ] Wire notify:weekly worker — weekly digest notification
- [ ] Show notification badge on home screen if unread insights exist
- [ ] Test notification list screen

**Milestone: "It watches for you" — Netflix shows up as a subscription automatically**

---

### Week 9 — Analytics & Insights

**Goal:** Analytics screen shows real spending data. Insight cards appear.

- [ ] Wire analytics screen: month-to-date, fixed vs flexible, top merchants
- [ ] Wire InsightGenerator — verify plain-English insight cards
- [ ] Show insight cards on home dashboard (top 3)
- [ ] Wire "See all" → analytics screen
- [ ] Wire insight dismiss (mark as read)
- [ ] Test insight rules: spending up/down, big category, unusual merchant
- [ ] Tune insight copy for clarity

**Milestone: "It explains your money" — user reads "You spent 23% more this week"**

---

### Week 10 — Polish & Edge Cases

**Goal:** Handle the 50 things that don't work in real life.

- [ ] Multi-account sync (user connects 2 banks)
- [ ] Consent expiry warning (< 14 days remaining → notification + banner)
- [ ] Consent re-auth flow (POST /connections/:id/refresh)
- [ ] Sync failure retry UX (error state → "Retry" button)
- [ ] Empty state for every screen when user has data then disconnects
- [ ] Handle app backgrounding during OAuth flow
- [ ] Fix layout issues on small screens (iPhone SE) and large screens (iPad)
- [ ] Fix dark mode consistency (any hardcoded colours)
- [ ] Add haptic feedback on budget create, category override
- [ ] Accessibility pass: screen reader labels on all interactive elements

**Milestone: "Doesn't break" — works with 2 banks, handles errors gracefully**

---

### Week 11 — Testing & Security

**Goal:** Confidence that it won't lose data or expose secrets.

- [ ] Write integration tests for critical API paths:
  - Auth register → me → update → delete
  - Connection create → callback → sync → transactions
  - Budget CRUD
  - Transaction category override
- [ ] Test webhook processing (mock TrueLayer events)
- [ ] Security checklist review — fix remaining items:
  - [ ] Strict OAuth state validation (Redis)
  - [ ] HTTPS enforcement
  - [ ] Privacy policy page
  - [ ] Verify no secrets in logs
- [ ] Load test: 100 concurrent users, 10k transactions
- [ ] Test on physical iOS and Android devices
- [ ] Fix any Expo build errors for standalone app

**Milestone: "Sleep at night" — critical paths tested, security gaps closed**

---

### Week 12 — Launch Prep

**Goal:** Ship to TestFlight / internal testers. Ready for real users.

- [ ] EAS Build for iOS (TestFlight) and Android (internal track)
- [ ] Production environment: TrueLayer live credentials, production Supabase, production PostgreSQL
- [ ] Verify TrueLayer live access (may require FCA sandbox → live approval)
- [ ] Configure production Redis for BullMQ
- [ ] Set up monitoring (Sentry for errors, basic uptime check)
- [ ] App Store metadata: screenshots, description, privacy policy URL
- [ ] Final QA pass with 3–5 real users and real bank accounts
- [ ] Fix critical bugs from QA
- [ ] Document deployment runbook (how to deploy API, run migrations, restart workers)
- [ ] Ship v1.0.0

**Milestone: "It's live" — real users, real banks, real money data**

---

## Key Milestones Summary

| Week | Milestone | Validates |
|------|-----------|-----------|
| 1 | Empty home screen | Auth, deployment, infra |
| 2 | Bank connected | TrueLayer OAuth, token storage |
| 3 | Real balances shown | Sync pipeline, encryption |
| 4 | Categorised transaction feed | Categorisation pipeline, pagination |
| 6 | Smart home dashboard | Analytics engine, data aggregation |
| 7 | Budget tracking works | Budget CRUD, spend calculation |
| 8 | Subscriptions detected | Recurring detection, notifications |
| 9 | Insight cards appear | Insight generator, plain-English copy |
| 11 | Tests pass, security review done | Production readiness |
| 12 | Shipped to real users | It works |

---

## What to Cut if Time is Tight

Cut from the bottom up. Each tier is independently shippable.

### Tier 1 — "Launch without these" (save 2 weeks)

| Feature | Why it's safe to cut | When to add |
|---------|---------------------|-------------|
| Insight cards | Nice-to-have, not core | Month 2 |
| Analytics screen | Dashboard covers basics | Month 2 |
| Notification settings | Hardcode sensible defaults | Month 2 |
| Transaction search | Users can scroll/filter | Month 2 |
| Consent re-auth flow | Not needed for 90 days | Week 10–12 of live usage |

### Tier 2 — "Bare minimum launch" (save 4 weeks)

| Feature | Why it's safe to cut | When to add |
|---------|---------------------|-------------|
| Everything in Tier 1 | | |
| Recurring detection | Runs automatically, but display can wait | Month 2 |
| Budgets | Users can track spending manually | Month 2 |
| Weekly summary batch | Show live current-week only | Month 2 |

### Tier 3 — "Demo only" (save 6 weeks)

| Feature | Only ship |
|---------|-----------|
| Auth + onboarding | Magic link sign-in |
| Account linking | Connect one bank |
| Balances | See account balances |
| Transactions | Categorised feed |
| Home screen | Balance + recent transactions |

**This is the smallest thing that proves the product works.** 6 weeks to here.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TrueLayer sandbox → live approval delay | Medium | High | Start application in Week 1, not Week 11 |
| Irish bank API flakiness / downtime | Medium | Medium | Retry logic + graceful error states already built |
| Merchant normalisation misses Irish patterns | High | Low | Tune iteratively with real sandbox data, add patterns to seed |
| Expo build fails on specific devices | Medium | Medium | Test on physical devices from Week 8, not Week 12 |
| App Store review rejection | Low | High | Submit privacy policy early, use standard permissions only |
| Redis/BullMQ complexity for solo dev | Low | Medium | Upstash serverless Redis, BullMQ is battle-tested |

---

## MVP Launch Checklist

### Infrastructure
- [ ] Production PostgreSQL with automated daily backups
- [ ] Production Redis (Upstash or managed)
- [ ] API deployed with health check monitoring
- [ ] Worker process running alongside API
- [ ] TLS/HTTPS on all endpoints
- [ ] Environment secrets in platform secrets manager (not .env files)
- [ ] Sentry or equivalent for error tracking

### TrueLayer
- [ ] Live API credentials (not sandbox)
- [ ] Redirect URI configured for production deep link
- [ ] Webhook endpoint registered and verified
- [ ] Tested with at least one real Irish bank account

### Mobile App
- [ ] EAS Build succeeds for iOS and Android
- [ ] TestFlight / internal testing track uploaded
- [ ] App icon, splash screen, and metadata finalised
- [ ] Deep links work (`clearmoney://` scheme)
- [ ] Tested on iOS 16+ and Android 12+
- [ ] No crashes on cold start, backgrounding, or network loss

### Security
- [ ] CORS restricted to production origins
- [ ] Security headers active (HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting active
- [ ] All route params validated (Zod UUID)
- [ ] OAuth state validated via Redis
- [ ] No secrets in logs (verified)
- [ ] Token encryption key rotatable

### Legal / Compliance
- [ ] Privacy policy published and accessible from app
- [ ] Terms of service published
- [ ] GDPR data export endpoint functional
- [ ] Account deletion works end-to-end
- [ ] Cookie/tracking disclosure (if applicable)

### Quality
- [ ] Integration tests pass for auth, sync, transactions, budgets
- [ ] Manual QA on 2+ real bank accounts
- [ ] All screens have loading, empty, and error states
- [ ] Accessibility: screen reader labels on interactive elements
- [ ] No TypeScript errors (`tsc --noEmit` clean)

### Operations
- [ ] Deployment runbook documented
- [ ] Incident response runbook documented
- [ ] Database migration procedure documented
- [ ] Monitoring alerts configured (API down, sync failure rate > 10%, error rate spike)
- [ ] At least one person can be paged if something breaks
