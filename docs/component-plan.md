# Frontend Component Plan

## Design Tokens (existing)

From `tailwind.config.js`:

```
background:    #0F172A  (slate-900)    — screen backgrounds
surface:       #1E293B  (slate-800)    — cards, containers
surface-light: #334155  (slate-700)    — secondary surfaces, skeletons
primary-500:   #3b82f6  (blue-500)     — interactive elements
primary-600:   #2563eb  (blue-600)     — buttons, active states
```

Text: `text-white` (headlines), `text-slate-300` (body), `text-slate-400` (secondary), `text-slate-500` (disabled/hints)

Positive amounts: `text-emerald-400` (#34d399)
Negative amounts: `text-white` (default, blends in)
Warning: `text-amber-400` (#fbbf24)
Danger: `text-red-400` (#f87171)

Category colours: from `TRANSACTION_CATEGORIES` constant (12 fixed colours).

---

## 1. Component Inventory

### Foundation (5 components)

Already exist — minor enhancements needed.

| Component | File | Status |
|---|---|---|
| `ScreenContainer` | `ui/ScreenContainer.tsx` | Exists |
| `Card` | `ui/Card.tsx` | Exists |
| `Button` | `ui/Button.tsx` | Exists, add `size` and `icon` props |
| `Text` | `ui/Text.tsx` | **New** — typed text with preset styles |
| `Divider` | `ui/Divider.tsx` | **New** — horizontal line |

### Data Display (11 components)

| Component | Purpose |
|---|---|
| `AmountText` | Formatted euro amount with sign colouring |
| `PercentBadge` | "↓ 12%" or "↑ 23%" with colour |
| `SummaryCard` | Spent/Earned with change badge (home hero) |
| `BalanceCard` | Account name + balance (horizontal scroll) |
| `TransactionRow` | Category dot + merchant + amount + time |
| `TransactionGroup` | Day header + list of `TransactionRow` |
| `CategoryChip` | Filter pill with colour dot |
| `CategoryBar` | Horizontal bar with label and amount |
| `BudgetProgressBar` | Category + progress bar + remaining text |
| `RecurringCard` | Merchant + amount/freq + next due date |
| `InsightCard` | Title + body + optional action |

### Charts (3 components)

| Component | Purpose |
|---|---|
| `WeeklyBarChart` | 7-day spending bars (Mon–Sun) |
| `CategoryPie` | Donut chart with category breakdown |
| `SpendingTrend` | Sparkline of 12 weekly totals |

### State Components (4 components)

| Component | Purpose |
|---|---|
| `EmptyState` | Icon + headline + body + optional CTA |
| `Skeleton` | Shimmer placeholder (configurable shape) |
| `ErrorBanner` | Inline error with retry button |
| `SyncBadge` | "Updated 12m ago" or "Syncing..." |

### Feedback (3 components)

| Component | Purpose |
|---|---|
| `AlertBanner` | Full-width banner (info/warning/error) |
| `Toast` | Temporary feedback ("Category updated") |
| `ConfirmSheet` | Bottom sheet with confirm/cancel |

**Total: 26 components** (3 existing + 23 new)

---

## 2. Props for Each Component

### Foundation

```typescript
// Text — preset styles to avoid repeating className combinations
interface TextProps {
  variant: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
  color?: 'primary' | 'secondary' | 'muted' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}
// h1: text-2xl font-bold text-white
// h2: text-lg font-semibold text-white
// h3: text-base font-semibold text-white
// body: text-base text-slate-300
// caption: text-sm text-slate-400
// label: text-xs uppercase tracking-wide text-slate-500

// Divider
interface DividerProps {
  spacing?: 'sm' | 'md' | 'lg';  // vertical margin: 8, 16, 24
}

// Button (enhanced)
interface ButtonProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;                  // MaterialIcons name
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}
```

### Data Display

```typescript
// AmountText — the most reused component in the app
interface AmountTextProps {
  amount: number;               // negative = spent, positive = earned
  currency?: string;            // default 'EUR'
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSign?: boolean;           // show +/- prefix
  colorize?: boolean;           // green for positive, white for negative
}
// sm: text-sm    md: text-base    lg: text-xl    xl: text-3xl

// PercentBadge — "↓ 12%" or "↑ 23%"
interface PercentBadgeProps {
  value: number;                // positive = up, negative = down
  label?: string;               // "vs last week"
}
// Positive: red bg, "↑ 23%"
// Negative: green bg, "↓ 12%" (spending down = good)
// Zero/null: grey bg, "—"

// SummaryCard — the hero card on the home screen
interface SummaryCardProps {
  spent: number;
  earned: number;
  changePercent: number | null;
  weekStart: string;            // "2026-03-30"
  weekEnd: string;
  dailyBreakdown?: number[];    // 7 values for bar chart
}

// BalanceCard — single account in horizontal scroll
interface BalanceCardProps {
  accountId: string;
  bankName: string;
  accountType: string;          // "Current" | "Savings"
  balance: number;
  lastSynced: string | null;
  onPress: () => void;
}

// TransactionRow — single transaction in the feed
interface TransactionRowProps {
  id: string;
  merchantName: string;
  categoryId: string;           // lookup colour/icon from constant
  amount: number;
  bookedAt: string;             // ISO datetime
  isPending: boolean;
  onPress: () => void;
  onLongPress?: () => void;     // quick re-categorise
}

// TransactionGroup — day header + rows
interface TransactionGroupProps {
  date: string;                 // ISO date
  label: string;                // "Today", "Yesterday", "Monday, 31 Mar"
  transactions: TransactionRowProps[];
}

// CategoryChip — filter pill
interface CategoryChipProps {
  categoryId: string;
  label: string;
  color: string;
  isSelected: boolean;
  onPress: () => void;
}

// CategoryBar — horizontal bar in category breakdown
interface CategoryBarProps {
  categoryId: string;
  label: string;
  color: string;
  amount: number;
  percent: number;              // 0–100, drives bar width
  count: number;                // transaction count
  onPress?: () => void;
}

// BudgetProgressBar — budget with progress indicator
interface BudgetProgressBarProps {
  budgetId: string;
  categoryId: string;
  label: string;
  color: string;
  limit: number;
  spent: number;
  percent: number;
  daysRemaining: number;
  onPress: () => void;
}
// Progress bar colour logic:
//   0–60%:  category colour (normal)
//   60–90%: amber-400
//   90%+:   red-400

// RecurringCard — subscription or bill row
interface RecurringCardProps {
  id: string;
  merchantName: string;
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  nextDueDate: string | null;
  categoryId: string;
  onPress: () => void;
  onDismiss: () => void;        // swipe action
}

// InsightCard — plain-English insight on home screen
interface InsightCardProps {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: number;
  isRead: boolean;
  onPress: () => void;
  onDismiss?: () => void;
}
```

### Charts

```typescript
// WeeklyBarChart — 7 bars for Mon–Sun spending
interface WeeklyBarChartProps {
  data: number[];               // exactly 7 values
  currentDayIndex: number;      // 0=Mon, 6=Sun — highlight this bar
  height?: number;              // default 60
}

// CategoryPie — donut chart
interface CategoryPieProps {
  segments: Array<{
    categoryId: string;
    color: string;
    amount: number;
    percent: number;
  }>;
  totalSpent: number;
  size?: number;                // diameter, default 180
  onSegmentPress?: (categoryId: string) => void;
}

// SpendingTrend — sparkline of weekly totals
interface SpendingTrendProps {
  data: Array<{
    weekStart: string;
    totalSpent: number;
  }>;
  height?: number;              // default 40
}
```

### State Components

```typescript
// EmptyState — zero-data placeholder
interface EmptyStateProps {
  icon: string;                 // MaterialIcons name
  title: string;
  body: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

// Skeleton — shimmer placeholder
interface SkeletonProps {
  variant: 'text' | 'card' | 'row' | 'circle' | 'chart';
  width?: number | string;      // default '100%'
  height?: number;              // auto-set per variant
  count?: number;               // repeat N times (for lists)
}
// Renders bg-surface-light with left-to-right shimmer animation

// ErrorBanner — inline error within a section
interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

// SyncBadge — data freshness indicator
interface SyncBadgeProps {
  lastSyncedAt: string | null;
  isSyncing: boolean;
  onSyncPress?: () => void;
}
// Renders: "Updated 12m ago" | "Syncing..." | "Tap to sync" (if stale >24h)
```

### Feedback

```typescript
// AlertBanner — full-width persistent banner
interface AlertBannerProps {
  variant: 'info' | 'warning' | 'error' | 'success';
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  onDismiss?: () => void;
}

// Toast — temporary bottom notification
interface ToastProps {
  message: string;
  duration?: number;            // ms, default 3000
  action?: {
    label: string;
    onPress: () => void;
  };
}

// ConfirmSheet — bottom sheet with destructive action
interface ConfirmSheetProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}
```

---

## 3. Component Hierarchy by Screen

### Home Dashboard

```
ScreenContainer
├── View (header row)
│   ├── Text variant="h1" → "ClearMoney"
│   └── SyncBadge
│
├── SummaryCard                          ← hero section
│   ├── AmountText size="xl" → spent
│   ├── AmountText size="xl" → earned
│   ├── PercentBadge → vs last week
│   └── WeeklyBarChart → 7-day bars
│
├── InsightCard (first unread only)      ← max 1 above fold
│
├── View (section: "Budgets")
│   ├── Text variant="h2"
│   └── BudgetProgressBar (×N)
│       or EmptyState if no budgets
│
├── View (section: "Where your money went")
│   ├── Text variant="h2"
│   ├── CategoryPie
│   └── CategoryBar (×N)
│       or EmptyState if no data
│
├── View (section: "Coming Up")
│   ├── Text variant="h2"
│   └── RecurringCard (×N, next 5)
│       or EmptyState if none
│
├── View (section: "Recent Transactions")
│   ├── Text variant="h2"
│   ├── TransactionRow (×5 max)
│   └── Button variant="ghost" → "See all →"
│
└── View (section: "Accounts")
    └── ScrollView horizontal
        └── BalanceCard (×N)
```

### Transactions

```
ScreenContainer
├── Text variant="h1" → "Transactions"
├── View (search + filter row)
│   ├── Pressable → search icon
│   └── ScrollView horizontal
│       └── CategoryChip (×12 + "All")
│
├── FlatList
│   └── TransactionGroup (×N)
│       ├── Text variant="label" → day header (sticky)
│       └── TransactionRow (×N)
│           or Skeleton variant="row" count={8} while loading
│
└── (footer)
    └── Skeleton variant="row" count={3} during load-more
    or Text → "That's everything"
```

### Budgets

```
ScreenContainer
├── View (header row)
│   ├── Text variant="h1" → "Budgets"
│   └── Button size="sm" → "+ Add"
│
├── Text variant="caption" → "April (3 days left)"
│
├── View (active budgets)
│   └── BudgetProgressBar (×N)
│       └── onPress → push budget/[id]
│   or EmptyState
│       icon="pie-chart"
│       title="No budgets yet"
│       action={ label: "Create Your First Budget", onPress }
│
├── Divider
│
└── View (previous month)
    ├── Text variant="h2" → "Last Month"
    └── Card (×N, compact summary rows)
```

### Recurring Payments

```
ScreenContainer
├── Text variant="h1" → "Recurring"
│
├── Card (totals hero)
│   ├── AmountText size="xl" → monthly total
│   ├── Text variant="caption" → "per month"
│   ├── Divider
│   ├── View (fixed vs subs bar)
│   │   ├── View bg={color} flex={fixedPct}
│   │   └── View bg={color} flex={subsPct}
│   └── View (legend)
│       ├── Text → "Fixed (bills) €89"
│       └── Text → "Subscriptions €38"
│
├── Text variant="h2" → "Subscriptions"
├── RecurringCard (×N, where category=SUBSCRIPTIONS)
│   or EmptyState
│
├── Text variant="h2" → "Bills"
├── RecurringCard (×N, where category=BILLS)
│   or EmptyState
│
└── Text variant="caption" → "Swipe left to dismiss"
```

### Transaction Detail (modal)

```
ScreenContainer (no scroll, modal presentation)
├── View (drag handle)
│
├── View (centred hero)
│   ├── Text variant="h2" → merchant name
│   └── AmountText size="xl" → amount
│
├── Pressable (category row — tappable to change)
│   ├── View (colour dot)
│   ├── Text → category label
│   └── MaterialIcons → "chevron-right"
│
├── Divider
│
├── View (detail rows)
│   ├── DetailRow label="Date" value="Today, 2:14 PM"
│   ├── DetailRow label="Account" value="AIB Current"
│   ├── DetailRow label="Status" value="Booked"
│   └── DetailRow label="Description" value="POS TESCO..."
│
├── Divider
│
└── Card (hint)
    └── Text variant="caption" → "Tap the category to change it..."
```

### Settings

```
ScreenContainer
├── Text variant="h1" → "Settings"
├── Text variant="caption" → email
│
├── Card (connected banks section)
│   ├── Text variant="h3" → "Connected Banks"
│   ├── View (×N per connection)
│   │   ├── Text → bank name
│   │   ├── Text variant="caption" → "2 accounts · Active"
│   │   ├── SyncBadge
│   │   └── Pressable → "···" menu
│   └── Button variant="secondary" → "+ Connect Another Bank"
│
├── Card (preferences section)
│   ├── Text variant="h3" → "Preferences"
│   ├── SettingsRow label="Notifications" type="navigation"
│   ├── SettingsRow label="Currency" value="EUR"
│   └── SettingsRow label="Budget Start Day" value="1st"
│
├── Card (data section)
│   ├── SettingsRow label="Export to CSV" type="navigation"
│   └── SettingsRow label="Delete Account" type="danger"
│
├── Button variant="danger" → "Sign Out"
│
└── Text variant="caption" → "v1.0.0 · Data from TrueLayer"
```

---

## 4. UI States Per Component

### TransactionRow

| State | Visual |
|---|---|
| Default | White merchant, slate-400 category, white amount |
| Pending | Amber "Pending" badge, amount in slate-400 (dimmed) |
| Positive (income) | Amount in emerald-400 with "+" prefix |
| Pressed | opacity-80 background highlight |
| Loading | `Skeleton variant="row"` |

### BudgetProgressBar

| State | Visual |
|---|---|
| Healthy (0–60%) | Category colour bar, white text |
| Warning (60–90%) | Amber bar, amber remaining text |
| Danger (90–99%) | Red bar, red remaining text |
| Exceeded (100%+) | Full red bar, "Over by €23" in red |
| No data yet | Grey bar at 0%, "No spending yet" |

### InsightCard

| State | Visual |
|---|---|
| Unread | `bg-surface` with left blue accent border |
| Read | `bg-surface` with no accent border, lower opacity title |
| High priority (7+) | Slightly larger title, blue accent |
| Actionable | "→" chevron on the right side |
| Dismissed | Fade-out animation, removed from list |

### RecurringCard

| State | Visual |
|---|---|
| Default | Merchant + amount + "next: Apr 7" |
| Overdue | Red "Overdue" badge, amount in red |
| Upcoming (within 3 days) | Amber "Due soon" indicator |
| Swiped | Red "Dismiss" action revealed |
| Dismissed | Slide-out animation |

### SummaryCard

| State | Visual |
|---|---|
| Loaded | Spent/Earned amounts, bar chart, percent badge |
| Loading | `Skeleton variant="card"` with shimmer bars |
| No data (first week) | "Connect a bank to see your weekly summary" |
| Error | `ErrorBanner` inside the card |

### BalanceCard

| State | Visual |
|---|---|
| Active | Bank name, balance, "Updated 12m ago" |
| Syncing | Balance shown, spinner replacing sync text |
| Stale (>24h) | Amber "Last synced 2 days ago" |
| Expired consent | Red "Connection expired" + "Renew →" |

### EmptyState

| Variant | Used On |
|---|---|
| No bank connected | Home, Transactions |
| Syncing in progress | Home (first load) |
| No transactions | Transactions (after sync, if empty) |
| No filter results | Transactions (filter applied, nothing matches) |
| No budgets | Budgets tab |
| No recurring detected | Recurring tab |
| No insights | Home (insights section) |
| All caught up | Insights list (all read) |

### Skeleton

| Variant | Appearance |
|---|---|
| `text` | Single line, rounded rect, height 16, width varies |
| `card` | Full-width rounded rect, height 120 |
| `row` | Left circle (32) + two text lines + right text |
| `circle` | Circle, for avatars or dots |
| `chart` | 7 vertical bars of varying height |

---

## 5. Accessibility

### Screen Reader

| Component | `accessibilityLabel` | `accessibilityRole` |
|---|---|---|
| `AmountText` | "Spent 342 euro and 87 cents" | `text` |
| `PercentBadge` | "Down 12 percent compared to last week" | `text` |
| `TransactionRow` | "Tesco, Groceries, minus 23 euro 45, Today" | `button` |
| `BudgetProgressBar` | "Dining budget, 154 of 200 euro, 77 percent used, 46 euro remaining" | `button` |
| `RecurringCard` | "Netflix, 15 euro 99 per month, next due April 7th" | `button` |
| `InsightCard` | "{title}. {body}" | `button` |
| `CategoryChip` | "{label} filter, {selected ? 'active' : 'inactive'}" | `button` |
| `BalanceCard` | "AIB Current Account, balance 4230 euro" | `button` |
| `WeeklyBarChart` | "Spending this week. Monday 45 euro, Tuesday 23 euro..." | `image` |
| `CategoryPie` | "Category breakdown. Groceries 24 percent, Dining 22 percent..." | `image` |

### Rules

1. **All monetary values spoken in full**: "23 euro and 45 cents", never "23.45"
2. **Percentages spoken plainly**: "77 percent", not "77%"
3. **Dates spoken naturally**: "Today", "Yesterday", "Monday March 31st"
4. **Charts have text alternatives**: VoiceOver reads the data, not "image"
5. **All interactive elements** have `accessibilityRole="button"` and a clear label
6. **Colour is never the only indicator**: budget bars show text ("77%") alongside colour. Category chips have labels alongside dots.
7. **Minimum touch targets**: 44x44pt for all tappable elements
8. **Reduce motion**: respect `AccessibilityInfo.isReduceMotionEnabled` — skip bar/pie animations, counter transitions
9. **Dynamic type**: all text uses relative sizing via NativeWind. Test at maximum accessibility text size.
10. **Focus order**: tab order matches visual reading order (top-to-bottom, left-to-right)

---

## 6. Design Consistency Rules

### Spacing

| Token | Value | Usage |
|---|---|---|
| `p-4` | 16px | Standard card padding, screen edges |
| `mt-2` | 8px | Between related elements (label → value) |
| `mt-4` | 16px | Between cards in the same section |
| `mt-6` | 24px | Between sections |
| `gap-2` | 8px | Between chips, between inline elements |
| `gap-3` | 12px | Between rows in a list |

### Typography Scale

| Use | Class | Size |
|---|---|---|
| Screen title | `text-2xl font-bold text-white` | 24px |
| Section header | `text-lg font-semibold text-white` | 18px |
| Card title | `text-base font-semibold text-white` | 16px |
| Body text | `text-base text-slate-300` | 16px |
| Secondary text | `text-sm text-slate-400` | 14px |
| Hint/meta | `text-xs text-slate-500` | 12px |
| Hero number | `text-3xl font-bold text-white` | 30px |

### Corner Radius

| Element | Class | Radius |
|---|---|---|
| Cards | `rounded-2xl` | 16px |
| Buttons | `rounded-xl` | 12px |
| Chips | `rounded-full` | 9999px |
| Progress bars | `rounded-full` | 9999px |
| Input fields | `rounded-xl` | 12px |

### Colour Rules

1. **One accent colour per screen section.** The home hero uses blue. Budget bars use category colours. Don't mix.
2. **Green = positive** (income, spending down, on-track budgets). **Red = negative** (over budget, overdue). **Amber = warning** (approaching limit, pending, stale).
3. **Category colours are fixed.** Never change them. Users build muscle memory around "green = groceries".
4. **Backgrounds never change.** `background` for screens, `surface` for cards. No exceptions.
5. **Interactive = blue.** Buttons, links, and tappable elements are `primary-500` or `primary-600`. Nothing else is blue.
6. **White for hero numbers only.** Other numbers use `slate-300`. Only the single most important number per section gets white + bold.

### Component Naming Conventions

```
ui/           — generic, reusable, no business logic
  Text.tsx
  Card.tsx
  Button.tsx
  Divider.tsx
  Skeleton.tsx
  EmptyState.tsx
  ErrorBanner.tsx
  AlertBanner.tsx
  Toast.tsx
  ConfirmSheet.tsx

finance/      — business-specific, use domain types
  AmountText.tsx
  PercentBadge.tsx
  SummaryCard.tsx
  BalanceCard.tsx
  TransactionRow.tsx
  TransactionGroup.tsx
  CategoryChip.tsx
  CategoryBar.tsx
  BudgetProgressBar.tsx
  RecurringCard.tsx
  InsightCard.tsx
  SyncBadge.tsx

charts/       — visualisations
  WeeklyBarChart.tsx
  CategoryPie.tsx
  SpendingTrend.tsx
```

### Component Rules

1. **No business logic in components.** Components render props. Screens fetch data and wire it up.
2. **All components accept `className` for escape-hatch overrides** via NativeWind.
3. **No inline colours.** All colours come from tailwind tokens or the `TRANSACTION_CATEGORIES` constant.
4. **Every list item has `onPress`.** Nothing should look tappable but not be.
5. **Loading state = skeleton.** Every component that fetches data has a corresponding skeleton variant.
6. **Empty state = explicit.** Never render a blank section. Always show `EmptyState` with a message.
7. **Animations are optional.** Every animated component respects `reduceMotion`. The app must be fully functional with animations disabled.

---

## 7. File Structure

```
src/components/
├── ui/
│   ├── ScreenContainer.tsx       (exists)
│   ├── Card.tsx                  (exists)
│   ├── Button.tsx                (exists, enhance)
│   ├── Text.tsx                  (new)
│   ├── Divider.tsx               (new)
│   ├── Skeleton.tsx              (new)
│   ├── EmptyState.tsx            (new)
│   ├── ErrorBanner.tsx           (new)
│   ├── AlertBanner.tsx           (new)
│   ├── Toast.tsx                 (new)
│   └── ConfirmSheet.tsx          (new)
│
├── finance/
│   ├── AmountText.tsx            (new)
│   ├── PercentBadge.tsx          (new)
│   ├── SummaryCard.tsx           (new)
│   ├── BalanceCard.tsx           (new)
│   ├── TransactionRow.tsx        (new)
│   ├── TransactionGroup.tsx      (new)
│   ├── CategoryChip.tsx          (new)
│   ├── CategoryBar.tsx           (new)
│   ├── BudgetProgressBar.tsx     (new)
│   ├── RecurringCard.tsx         (new)
│   ├── InsightCard.tsx           (new)
│   └── SyncBadge.tsx             (new)
│
└── charts/
    ├── WeeklyBarChart.tsx        (new)
    ├── CategoryPie.tsx           (new)
    └── SpendingTrend.tsx         (new)
```

3 existing, 23 new. Each component is one file, one export, no barrel re-exports needed (Expo Metro resolves imports directly).
