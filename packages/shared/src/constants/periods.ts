export const BUDGET_PERIODS = {
  WEEKLY: { label: 'Weekly', days: 7 },
  FORTNIGHTLY: { label: 'Fortnightly', days: 14 },
  MONTHLY: { label: 'Monthly', days: 30 },
} as const;

export type BudgetPeriod = keyof typeof BUDGET_PERIODS;

export const RECURRING_FREQUENCIES = [
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
] as const;

export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];
