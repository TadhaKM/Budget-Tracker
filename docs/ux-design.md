# ClearMoney — UX Design

## Design Philosophy

ClearMoney is for people who want to understand their money without becoming a financial analyst. Every screen should pass the "glance test" — can the user get the answer they came for within 2 seconds? If not, the screen is too complex.

### Core Principles

1. **Numbers first, chrome second.** The biggest element on every screen should be a number the user cares about. Not a logo, not a menu, not a decorative illustration.

2. **Plain English over financial jargon.** "You spent €47 less than last week" beats "Week-over-week expenditure variance: -12.3%". The user is a person, not a spreadsheet.

3. **Show, don't configure.** The app should work out of the box with zero setup. Categories are automatic. Recurring payments are detected. Insights are generated. The user's only job is connecting their bank.

4. **Dark by default.** Finance apps feel more premium and trustworthy on dark backgrounds. Light mode is a future option, not a priority.

5. **One tap to the answer.** The home screen answers "how am I doing?" The transaction list answers "where did my money go?" Budgets answer "am I on track?" Each tab is one question, one answer.

6. **Progressive disclosure.** Show the headline first. Details on tap. History on scroll. Never dump everything at once.

7. **Trust through transparency.** Show when data was last synced. Show which bank the data came from. Never hide the source.

---

## 1. Information Architecture

```
ClearMoney
├── Auth
│   ├── Welcome (first launch)
│   ├── Sign In (magic link)
│   └── Check Email (confirmation)
│
├── Onboarding (first time after sign-in)
│   ├── Step 1: Connect Your Bank
│   ├── Step 2: Syncing... (progress)
│   └── Step 3: You're All Set
│
├── Main App (5 tabs)
│   ├── Home (dashboard)
│   ├── Transactions (feed)
│   ├── Budgets (limits)
│   ├── Recurring (subs + bills)
│   └── Settings (account + connections)
│
├── Detail Screens (push navigation)
│   ├── Transaction Detail
│   ├── Account Detail
│   ├── Budget Detail + History
│   ├── Category Drill-Down
│   └── Insight Detail
│
├── Modals
│   ├── Connect Bank (WebView for OAuth)
│   ├── Create Budget
│   ├── Edit Category (re-categorise)
│   └── Period Picker (date range)
│
└── Sheets (bottom sheet)
    ├── Account Switcher
    ├── Category Filter
    └── Recurring Payment Detail
```

---

## 2. Screen List

### Auth Flow (3 screens)

| # | Screen | Route | Purpose |
|---|---|---|---|
| 1 | Welcome | `(auth)/welcome` | First launch — logo, tagline, "Get Started" button |
| 2 | Sign In | `(auth)/sign-in` | Email input + "Send Magic Link" |
| 3 | Check Email | `(auth)/sign-in` (state) | Confirmation message after OTP sent |

### Onboarding (3 screens)

| # | Screen | Route | Purpose |
|---|---|---|---|
| 4 | Connect Bank | `onboarding/connect` | Pick your bank (AIB, BOI, PTSB) |
| 5 | Syncing | `onboarding/syncing` | Progress indicator during initial sync |
| 6 | All Set | `onboarding/complete` | Success state, "Go to Home" |

### Main Tabs (5 screens)

| # | Screen | Route | Purpose |
|---|---|---|---|
| 7 | Home | `(tabs)/index` | Dashboard — the single screen 80% of sessions start and end on |
| 8 | Transactions | `(tabs)/transactions` | Chronological feed with filters |
| 9 | Budgets | `(tabs)/budgets` | Category spending limits with progress bars |
| 10 | Recurring | `(tabs)/subscriptions` | Detected subscriptions and bills |
| 11 | Settings | `(tabs)/settings` | Account, connections, preferences |

### Detail & Modal Screens (8 screens)

| # | Screen | Route | Purpose |
|---|---|---|---|
| 12 | Transaction Detail | `transaction/[id]` | Full detail, re-categorise action |
| 13 | Account Detail | `account/[id]` | Balance, transactions for one account |
| 14 | Budget Detail | `budget/[id]` | History, snapshots, trend |
| 15 | Category Drill-Down | `category/[id]` | All transactions in one category for a period |
| 16 | Connect Bank Modal | Modal WebView | TrueLayer OAuth flow |
| 17 | Create Budget | Modal | Category picker + amount input |
| 18 | Edit Category | Bottom sheet | Re-categorise a transaction |
| 19 | Insight Detail | Bottom sheet | Expanded insight with action |

**Total: 19 screens** for a complete MVP.

---

## 3. Navigation Structure

### Tab Bar (persistent, 5 items)

```
┌─────────┬──────────────┬──────────┬───────────┬──────────┐
│  Home   │ Transactions │ Budgets  │ Recurring │ Settings │
│  (home) │ (receipt)    │ (pie)    │ (refresh) │ (gear)   │
└─────────┴──────────────┴──────────┴───────────┴──────────┘
```

- Home = `MaterialIcons:home`
- Transactions = `MaterialIcons:receipt-long`
- Budgets = `MaterialIcons:pie-chart`
- Recurring = `MaterialIcons:autorenew`
- Settings = `MaterialIcons:settings`

### Navigation Patterns

| Interaction | Navigation Type | Example |
|---|---|---|
| Tap a transaction | Push (card) | Transaction list → Transaction Detail |
| Tap an account card | Push (card) | Home → Account Detail |
| Tap a budget bar | Push (card) | Budgets → Budget Detail |
| Tap a category pie slice | Push (card) | Home → Category Drill-Down |
| Tap "Connect Bank" | Modal (full screen) | Settings → WebView OAuth |
| Tap "Add Budget" | Modal (half screen) | Budgets → Create Budget sheet |
| Tap category on transaction | Bottom sheet | Transaction Detail → Edit Category |
| Tap an insight card | Bottom sheet or push | Home → Insight Detail |
| Pull to refresh | In-place reload | Any tab |

### Deep Links

```
clearmoney://connection/success   → Onboarding "All Set" or Settings
clearmoney://connection/error     → Error state with retry
clearmoney://transaction/{id}     → Transaction Detail
```

---

## 4. Screen-by-Screen Wireframe Descriptions

### Screen 1: Welcome

```
┌────────────────────────────┐
│                            │
│                            │
│        [ClearMoney         │
│         logo/mark]         │
│                            │
│   See all your money       │
│      in one place.         │
│                            │
│   Connect your Irish bank  │
│   and we'll handle the     │
│   rest. Read-only.         │
│   Always secure.           │
│                            │
│   ┌──────────────────────┐ │
│   │    Get Started       │ │
│   └──────────────────────┘ │
│                            │
│   Already have an account? │
│   Sign in                  │
│                            │
└────────────────────────────┘
```

**Key details:**
- Centred layout, maximum whitespace
- "Read-only. Always secure." builds immediate trust
- Single primary CTA, secondary text link

### Screen 2: Sign In

```
┌────────────────────────────┐
│                            │
│   ClearMoney               │
│   See all your money       │
│   in one place             │
│                            │
│   ┌──────────────────────┐ │
│   │ you@example.com      │ │
│   └──────────────────────┘ │
│                            │
│   ┌──────────────────────┐ │
│   │   Send Magic Link    │ │
│   └──────────────────────┘ │
│                            │
│   No password needed.      │
│   We'll email you a        │
│   sign-in link.            │
│                            │
└────────────────────────────┘
```

**After sending:**

```
│   ✓ Check your email       │
│                            │
│   We sent a magic link     │
│   to john@example.com      │
│                            │
│   Didn't get it?           │
│   [Send again]             │
```

### Screen 4: Connect Bank (Onboarding)

```
┌────────────────────────────┐
│                            │
│   Connect your bank        │
│                            │
│   We'll securely connect   │
│   to your bank through     │
│   open banking. We can     │
│   only read — never move   │
│   your money.              │
│                            │
│   ┌──────────────────────┐ │
│   │ [AIB logo]  AIB    → │ │
│   └──────────────────────┘ │
│   ┌──────────────────────┐ │
│   │ [BOI logo]  Bank     │ │
│   │             of       │ │
│   │             Ireland→ │ │
│   └──────────────────────┘ │
│   ┌──────────────────────┐ │
│   │ [PTSB logo] PTSB   → │ │
│   └──────────────────────┘ │
│                            │
│   🔒 Regulated by the     │
│   Central Bank of Ireland  │
│                            │
│   [Skip for now]           │
│                            │
└────────────────────────────┘
```

**Key details:**
- "can only read — never move your money" is the #1 trust-builder
- Regulatory note at the bottom
- Skip option respects user agency
- Tapping a bank opens the TrueLayer WebView modal

### Screen 5: Syncing

```
┌────────────────────────────┐
│                            │
│                            │
│      [animated spinner     │
│       or progress ring]    │
│                            │
│   Connecting to AIB...     │
│                            │
│   Fetching your accounts   │
│   ✓ 2 accounts found       │
│                            │
│   Syncing transactions     │
│   ● ● ○ ○ ○               │
│                            │
│   This usually takes       │
│   about 30 seconds.        │
│                            │
└────────────────────────────┘
```

**Key details:**
- Step-by-step progress (accounts → balances → transactions)
- Honest time estimate ("about 30 seconds")
- No spinner without context — always say what's happening

### Screen 7: Home Dashboard

This is the most important screen. 80% of sessions are Home → glance → close.

```
┌────────────────────────────┐
│ ClearMoney     [sync icon] │
│ ─────────────────────────  │
│                            │  ← ABOVE THE FOLD
│ This Week          -12%  ↓ │  (visible without scrolling)
│ ┌──────────────────────────┤
│ │ Spent        Earned      │
│ │ €342         €2,450      │
│ │                          │
│ │ ▁▃▅▇▅▃▁  (7-day bars)  │
│ └──────────────────────────┤
│                            │
│ [Insight Card]             │
│ "Spending down 12%"        │
│ You spent €47 less than    │
│ last week. Keep it up!     │
│ ─────────────────────────  │
│                            │  ← SCROLL ZONE
│ Budgets                    │
│ ┌──────────────────────────┤
│ │ Dining     ████████░░ 77%│
│ │ Groceries  ███████░░░ 75%│
│ └──────────────────────────┤
│                            │
│ Where your money went      │
│ ┌──────────────────────────┤
│ │ 🟢 Groceries    €98  24%│
│ │ 🟠 Dining       €87  22%│
│ │ 🔵 Transport    €54  14%│
│ │ 🟣 Entertain.   €42  11%│
│ │ ⚪ Other        €62  29%│
│ └──────────────────────────┤
│                            │
│ Upcoming Bills             │
│ ┌──────────────────────────┤
│ │ Netflix    €15.99  Apr 7 │
│ │ Elec Ire   €89    Apr 10 │
│ └──────────────────────────┤
│                            │
│ Recent Transactions        │
│ ┌──────────────────────────┤
│ │ Tesco       -€23.45  12m│
│ │ Uber        -€12.30  2h │
│ │ Salary    +€2,450   Mon │
│ └──────────────────────────┤
│ [See all transactions →]   │
│                            │
│ Accounts                   │
│ ┌──────────────────────────┤
│ │ AIB Current    €4,230    │
│ │ AIB Savings    €8,100    │
│ └──────────────────────────┤
│                            │
└────────────────────────────┘
```

#### Above the Fold (what's visible without scrolling)

1. **Weekly spent vs earned** — the two numbers that matter most
2. **Percentage change** — "am I doing better or worse?"
3. **7-day bar chart** — spending shape at a glance (Mon–Sun, current day highlighted)
4. **Top insight card** — one plain-English sentence

Everything below the fold is bonus context for users who want to dig deeper.

#### Section Order (priority)

| Position | Section | Why here |
|---|---|---|
| 1 | Weekly spent/earned | Primary question: "how much?" |
| 2 | Insight card | Proactive advice, most valuable content |
| 3 | Budget progress bars | Active budgets need monitoring |
| 4 | Category breakdown | "Where is my money going?" |
| 5 | Upcoming bills | "What's coming next?" |
| 6 | Recent transactions | Quick glance, not the full feed |
| 7 | Accounts | Least-checked, bottom of scroll |

### Screen 8: Transactions

```
┌────────────────────────────┐
│ Transactions       [search]│
│ All your accounts, one list│
│                            │
│ [All] [Groceries] [Dining] │
│ [Transport] [Bills] [+more]│
│ ─────────────────────────  │
│                            │
│ TODAY                      │
│ ┌──────────────────────────┤
│ │ 🟢 Tesco                │
│ │    Groceries    -€23.45  │
│ ├──────────────────────────┤
│ │ 🔵 Uber                 │
│ │    Transport    -€12.30  │
│ └──────────────────────────┘
│                            │
│ YESTERDAY                  │
│ ┌──────────────────────────┤
│ │ 🟠 Deliveroo            │
│ │    Dining       -€28.50  │
│ ├──────────────────────────┤
│ │ 🟢 Lidl                 │
│ │    Groceries    -€45.20  │
│ ├──────────────────────────┤
│ │ 🟢 Salary               │
│ │    Income    +€2,450.00  │
│ └──────────────────────────┘
│                            │
│ MONDAY                     │
│ ...                        │
│                            │
│    [Loading more...]       │
│                            │
└────────────────────────────┘
```

**Key details:**
- Grouped by day with sticky headers
- Horizontal scrolling category filter chips
- Each row: category colour dot, merchant name, category label, amount
- Positive amounts in green, negative in white
- Pending transactions show a subtle "Pending" badge
- Pull to refresh triggers a sync
- Infinite scroll with cursor pagination
- Search icon opens text search overlay

### Screen 9: Budgets

```
┌────────────────────────────┐
│ Budgets       [+ Add]      │
│ Set limits, stay in control│
│                            │
│ April (3 days left)        │
│ ┌──────────────────────────┤
│ │ 🟠 Dining & Takeaway    │
│ │ €154 of €200             │
│ │ ████████████████░░░░ 77% │
│ │                          │
│ │ €46 left · 3 days        │
│ ├──────────────────────────┤
│ │ 🟢 Groceries            │
│ │ €298 of €400             │
│ │ ██████████████░░░░░░ 75% │
│ │                          │
│ │ €102 left · 3 days       │
│ ├──────────────────────────┤
│ │ 🟣 Entertainment        │
│ │ €42 of €100              │
│ │ ████████░░░░░░░░░░░░ 42% │
│ │                          │
│ │ €58 left · 3 days        │
│ └──────────────────────────┘
│                            │
│ Last Month                 │
│ ┌──────────────────────────┤
│ │ 🟠 Dining     ✓ On track│
│ │ €187 of €200             │
│ ├──────────────────────────┤
│ │ 🟢 Groceries  ✗ Over    │
│ │ €423 of €400             │
│ └──────────────────────────┘
│                            │
└────────────────────────────┘
```

**Key details:**
- Progress bar colour: green (0-60%), amber (60-90%), red (90%+)
- "€46 left · 3 days" answers "can I afford to eat out again?"
- Previous month summary shows trend (on track / over)
- Tapping a budget opens the detail screen with historical snapshots
- "+" button opens create budget modal (pick category → enter amount → done)

### Screen 10: Recurring Payments

```
┌────────────────────────────┐
│ Recurring                  │
│ Your subscriptions & bills │
│                            │
│ Monthly Total              │
│ ┌──────────────────────────┤
│ │ €127/month               │
│ │ €1,524/year              │
│ │                          │
│ │ ██ Fixed (bills)  €89    │
│ │ ██ Subs           €38    │
│ └──────────────────────────┤
│                            │
│ Subscriptions              │
│ ┌──────────────────────────┤
│ │ Netflix     €15.99/mo    │
│ │ next: Apr 7              │
│ ├──────────────────────────┤
│ │ Spotify     €10.99/mo    │
│ │ next: Apr 12             │
│ ├──────────────────────────┤
│ │ ChatGPT     €20.00/mo    │
│ │ next: Apr 15             │
│ └──────────────────────────┘
│                            │
│ Bills                      │
│ ┌──────────────────────────┤
│ │ Electric Ire €89.00/mo   │
│ │ next: Apr 10             │
│ ├──────────────────────────┤
│ │ Vodafone     €39.00/mo   │
│ │ next: Apr 18             │
│ └──────────────────────────┘
│                            │
│ Not a subscription?        │
│ Swipe left to dismiss      │
│                            │
└────────────────────────────┘
```

**Key details:**
- Split into Subscriptions (digital) and Bills (utilities/telecom)
- Annual total is the "shock number" that motivates action
- "next: Apr 7" tells the user when money will leave
- Swipe left to dismiss false positives
- Tapping opens a bottom sheet with payment history

### Screen 11: Settings

```
┌────────────────────────────┐
│ Settings                   │
│ john@example.com           │
│                            │
│ Connected Banks            │
│ ┌──────────────────────────┤
│ │ [AIB logo] AIB           │
│ │ 2 accounts · Active      │
│ │ Last synced: 12 min ago  │
│ │                    [···] │
│ └──────────────────────────┘
│                            │
│ [+ Connect Another Bank]   │
│                            │
│ Preferences                │
│ ┌──────────────────────────┤
│ │ Push Notifications   [→] │
│ ├──────────────────────────┤
│ │ Currency           EUR   │
│ ├──────────────────────────┤
│ │ Budget Start Day     1st │
│ └──────────────────────────┘
│                            │
│ Data                       │
│ ┌──────────────────────────┤
│ │ Export to CSV         [→] │
│ ├──────────────────────────┤
│ │ Delete Account        [→] │
│ └──────────────────────────┘
│                            │
│ [Sign Out]                 │
│                            │
│ v1.0.0 · Data from         │
│ TrueLayer open banking     │
│                            │
└────────────────────────────┘
```

**Key details:**
- "Last synced: 12 min ago" builds trust
- Three-dot menu on bank connection: Refresh, Disconnect
- Version + "Data from TrueLayer open banking" at footer for transparency
- Delete Account leads to a confirmation flow

### Screen 12: Transaction Detail (Modal)

```
┌────────────────────────────┐
│ ──── (drag handle)         │
│                            │
│          Tesco             │
│        -€23.45             │
│                            │
│   🟢 Groceries        [→] │
│                            │
│ ─────────────────────────  │
│                            │
│ Date      Today, 2:14 PM   │
│ Account   AIB Current      │
│ Status    Booked           │
│ Raw       POS TESCO STORES │
│           3219 DUBLIN IE   │
│                            │
│ ─────────────────────────  │
│                            │
│ This isn't Groceries?      │
│ ┌──────────────────────────┤
│ │ Tap the category above   │
│ │ to change it. We'll      │
│ │ remember for next time.  │
│ └──────────────────────────┘
│                            │
└────────────────────────────┘
```

**Key details:**
- Presented as a modal (swipe down to dismiss)
- Category row is tappable — opens the category picker bottom sheet
- "We'll remember for next time" explains the override system simply
- Raw bank description shown at the bottom for transparency
- Amount is the hero element — large, centred

---

## 5. Above the Fold — Home Screen Priority

What the user sees without scrolling on a standard phone (667pt viewport):

| Element | Height | Cumulative |
|---|---|---|
| Status bar + header | 88pt | 88pt |
| "This Week" + spent/earned | 120pt | 208pt |
| 7-day bar chart | 60pt | 268pt |
| Insight card | 80pt | 348pt |
| First budget bar | 60pt | 408pt |
| **Remaining viewport** | **259pt** | **667pt** |

The user sees: weekly totals, the trend, the top insight, and at least one budget bar — all without scrolling. That's enough to answer "how am I doing?" in under 2 seconds.

---

## 6. Empty States

Every screen needs a zero-data state that **guides** rather than disappoints.

| Screen | Empty State Headline | Body | CTA |
|---|---|---|---|
| Home (no bank) | "Connect your bank to get started" | "We'll show you where your money goes, spot your subscriptions, and help you budget — all automatically." | [Connect a Bank] |
| Home (syncing) | "Crunching the numbers..." | "We're fetching your transactions. This usually takes about 30 seconds." | (spinner) |
| Home (synced, no data) | "Looks like a fresh start" | "We didn't find any recent transactions. Check back after your next purchase." | — |
| Transactions (no bank) | "No transactions yet" | "Connect a bank account to see your spending history." | [Connect a Bank] |
| Transactions (synced, empty filter) | "No transactions match" | "Try a different filter or date range." | [Clear Filters] |
| Budgets (none set) | "No budgets yet" | "Set a spending limit for any category. We'll track it automatically." | [Create Your First Budget] |
| Recurring (none detected) | "No subscriptions detected yet" | "We'll automatically find recurring payments once you have a few months of data." | — |
| Search (no results) | "No matches" | "Try searching for a shop name or amount." | — |
| Insights (none) | "All caught up" | "No new insights right now. We'll let you know when something comes up." | — |

### Empty State Design Rules

- Always use a muted illustration or icon (not an error icon)
- Headline in white, body in slate-400
- If there's an action the user can take, show a single CTA button
- If there's nothing they can do, reassure them ("check back later")
- Never show a blank screen with no explanation

---

## 7. Loading States

| Situation | Treatment |
|---|---|
| Home screen loading | Skeleton screens (grey shimmer rectangles matching the layout shape) |
| Pull to refresh | Native iOS/Android refresh spinner at top |
| Transaction list loading more | Small spinner at bottom of list |
| Connecting a bank | Full-screen progress with steps |
| Category breakdown loading | Skeleton circles + bars |
| Any individual card loading | Skeleton matching card shape |
| API error (network) | Inline banner: "Couldn't load data. Check your connection." + [Retry] |
| API error (server) | Inline banner: "Something went wrong on our end. We're looking into it." |
| Sync stale (>24h) | Amber badge on sync icon: "Last synced 2 days ago" + [Sync Now] |

### Skeleton Screen Rules

- Match the exact shape and position of real content
- Use `bg-surface-light` with a subtle shimmer animation
- Never use spinners for the initial load — skeletons feel faster
- Spinners are only for user-initiated actions (pull to refresh, load more, submit)

---

## 8. Error States

| Error | Where | Treatment |
|---|---|---|
| Network offline | Global banner (top) | "You're offline. Showing cached data." (grey banner, persists until reconnected) |
| API 500 | Per-section | Replace section with: "Couldn't load [section name]" + [Retry] button |
| Bank connection failed | Onboarding / Settings | "We couldn't connect to AIB. This is usually temporary." + [Try Again] |
| Consent expired | Home (banner) + insight card | "Your AIB connection expired. Tap to renew." (amber banner, high priority) |
| Sync failed | Settings (connection card) | Red dot on bank card, "Last sync failed" in red text, [Retry] |
| Magic link expired | Auth | "This link has expired." + [Send a New One] |
| Rate limited | Hidden from user | Retry automatically in background. Only surface after 3+ failures. |

### Error Design Rules

- **Never show error codes or stack traces.** "Something went wrong" > "Error 500: Internal Server Error"
- **Always offer a next step.** Either a retry button or an explanation of what will happen automatically.
- **Distinguish temporary from permanent.** "This is usually temporary" vs "You'll need to reconnect."
- **Don't blame the user.** "We couldn't connect" not "You entered the wrong credentials."

---

## 9. Microcopy

### Onboarding

| Moment | Copy |
|---|---|
| Welcome headline | "See all your money in one place." |
| Welcome subtext | "Connect your Irish bank and we'll handle the rest. Read-only. Always secure." |
| Email field placeholder | "you@example.com" |
| Magic link button | "Send Magic Link" |
| Magic link sent | "Check your email. We sent a magic link to {email}." |
| Magic link help | "Didn't get it? Check your spam folder, or send again." |
| Bank picker intro | "We'll securely connect to your bank through open banking. We can only read — never move your money." |
| Bank connected | "You're all set! We found 2 accounts and 3 months of transactions." |
| Regulatory line | "Secured by TrueLayer, regulated by the Central Bank of Ireland." |

### Home Screen

| Element | Copy |
|---|---|
| Weekly header | "This Week" |
| Spent label | "Spent" |
| Earned label | "Earned" |
| Change badge (down) | "↓ 12% vs last week" |
| Change badge (up) | "↑ 23% vs last week" |
| Month-to-date header | "April so far" |
| Days remaining | "3 days left" |
| Upcoming bills header | "Coming Up" |
| Fixed vs flexible | "€843 fixed · €424 flexible" |
| Last synced | "Updated 12 min ago" |

### Transactions

| Element | Copy |
|---|---|
| Screen subtitle | "All your accounts, one list" |
| Filter: all | "All" |
| Pending badge | "Pending" |
| Today group header | "Today" |
| Yesterday header | "Yesterday" |
| Older day header | "Monday, 31 Mar" |
| Search placeholder | "Search transactions..." |
| No results | "No matches found" |
| Re-categorise hint | "This isn't Groceries? Tap to change." |
| Override confirmation | "Got it — future Tesco transactions will be filed under Dining." |

### Budgets

| Element | Copy |
|---|---|
| Screen subtitle | "Set limits, stay in control" |
| Remaining text | "€46 left · 3 days" |
| Over budget | "Over by €23" |
| On track badge | "On track" |
| Create budget title | "New Budget" |
| Category prompt | "What do you want to limit?" |
| Amount prompt | "How much per month?" |
| Created confirmation | "Budget set! We'll track it automatically." |
| Alert threshold | "Alert me at 80%" |

### Recurring Payments

| Element | Copy |
|---|---|
| Annual total | "€1,524/year in recurring charges" |
| Monthly total | "€127/month" |
| Next due | "next: Apr 7" |
| Dismiss hint | "Not a subscription? Swipe left to dismiss." |
| Dismissed confirmation | "Dismissed. We won't show this again." |
| New sub detected | "Looks like you started a new subscription to ChatGPT (€20/mo)." |

### Insight Cards

| Type | Title | Body |
|---|---|---|
| Spending down | "Spending down 12%" | "You spent €47 less than last week. Keep it up!" |
| Spending up | "Spending up 34%" | "You spent 34% more than last week — mostly on Dining." |
| Budget warning | "Dining budget at 77%" | "You've used €154 of your €200 Dining budget with 3 days left." |
| Budget exceeded | "Groceries over budget" | "You've gone over your €400 Groceries budget by €23." |
| Big category | "Groceries dominated" | "Groceries made up 45% of your spending this week." |
| Unusual charge | "Big Deliveroo order" | "Your Deliveroo order was €67 — usually it's around €22." |
| New subscription | "New recurring: ChatGPT" | "Looks like you started a new subscription to ChatGPT (€20/mo)." |
| Consent expiring | "Renew bank connection" | "Your AIB connection expires in 5 days. Tap to renew." |

### Settings

| Element | Copy |
|---|---|
| Bank status: active | "2 accounts · Active" |
| Bank status: synced | "Last synced: 12 min ago" |
| Bank status: expired | "Connection expired — tap to renew" |
| Bank status: failed | "Last sync failed — tap to retry" |
| Disconnect confirm | "Disconnect AIB? Your transaction history will be kept, but we'll stop syncing new data." |
| Delete account title | "Delete Your Account" |
| Delete account warning | "This will permanently remove all your data. This can't be undone." |
| Footer | "v1.0.0 · Data from TrueLayer open banking" |

---

## 10. Interaction Details

### Haptics

| Action | Haptic |
|---|---|
| Pull to refresh release | Light impact |
| Budget progress hits 100% | Warning notification |
| Transaction re-categorised | Success notification |
| Bank connected | Success notification |
| Swipe to dismiss recurring | Light impact |

### Animations

| Element | Animation |
|---|---|
| Weekly bar chart | Bars grow upward on appear (300ms, ease-out) |
| Budget progress bars | Fill left-to-right on appear (400ms, spring) |
| Insight cards | Fade-in + slide-up from bottom (200ms) |
| Category pie segments | Draw clockwise on appear (500ms) |
| Number changes | Counter animation (old → new, 300ms) |
| Skeleton shimmer | Left-to-right gradient slide (1.5s, loop) |

### Gestures

| Gesture | Location | Action |
|---|---|---|
| Pull down | Any tab | Refresh data |
| Swipe left | Recurring payment row | Reveal "Dismiss" button |
| Swipe down | Transaction detail modal | Dismiss |
| Long press | Transaction row | Quick category change |
| Tap category dot | Transaction row | Open category filter for that category |

---

## 11. File-Based Routing Map

How the screens map to the existing Expo Router structure:

```
src/app/
├── _layout.tsx                    ← Root (QueryProvider + AuthProvider)
├── (auth)/
│   ├── _layout.tsx                ← Auth stack
│   ├── welcome.tsx                ← NEW: Welcome screen
│   └── sign-in.tsx                ← Exists: magic link
├── onboarding/
│   ├── _layout.tsx                ← NEW: Onboarding stack
│   ├── connect.tsx                ← NEW: Bank picker
│   ├── syncing.tsx                ← NEW: Sync progress
│   └── complete.tsx               ← NEW: All set
├── (tabs)/
│   ├── _layout.tsx                ← Exists: 5-tab navigation
│   ├── index.tsx                  ← Exists: Home (rewrite needed)
│   ├── transactions.tsx           ← Exists: Transaction feed (rewrite)
│   ├── budgets.tsx                ← Exists: Budgets (rewrite)
│   ├── subscriptions.tsx          ← Exists: Recurring (rewrite)
│   └── settings.tsx               ← Exists: Settings (rewrite)
├── account/
│   └── [id].tsx                   ← Exists: Account detail (rewrite)
├── transaction/
│   └── [id].tsx                   ← Exists: Transaction detail (rewrite)
├── budget/
│   └── [id].tsx                   ← NEW: Budget detail + history
├── category/
│   └── [id].tsx                   ← NEW: Category drill-down
└── (modals)/
    ├── create-budget.tsx          ← NEW: Budget creation
    └── connect-bank.tsx           ← NEW: TrueLayer WebView
```

New files to create: **8**
Existing files to rewrite: **7**
Existing files unchanged: **8**
