export const TRANSACTION_CATEGORIES = {
  GROCERIES: { label: 'Groceries', icon: 'cart' },
  DINING: { label: 'Dining & Takeaway', icon: 'restaurant' },
  TRANSPORT: { label: 'Transport', icon: 'bus' },
  ENTERTAINMENT: { label: 'Entertainment', icon: 'film' },
  SHOPPING: { label: 'Shopping', icon: 'bag' },
  BILLS: { label: 'Bills & Utilities', icon: 'receipt' },
  HEALTH: { label: 'Health & Fitness', icon: 'heart' },
  SUBSCRIPTIONS: { label: 'Subscriptions', icon: 'refresh' },
  TRANSFERS: { label: 'Transfers', icon: 'swap-horizontal' },
  INCOME: { label: 'Income', icon: 'cash' },
  ATM: { label: 'Cash & ATM', icon: 'cash-outline' },
  OTHER: { label: 'Other', icon: 'ellipsis-horizontal' },
} as const;

export type TransactionCategory = keyof typeof TRANSACTION_CATEGORIES;

export const CATEGORY_LIST = Object.entries(TRANSACTION_CATEGORIES).map(([key, value]) => ({
  key: key as TransactionCategory,
  ...value,
}));
