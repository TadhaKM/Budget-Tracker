export const TRANSACTION_CATEGORIES = {
  GROCERIES: { label: 'Groceries', icon: 'cart', color: '#22c55e', isExpense: true },
  DINING: { label: 'Dining & Takeaway', icon: 'restaurant', color: '#f97316', isExpense: true },
  TRANSPORT: { label: 'Transport', icon: 'bus', color: '#3b82f6', isExpense: true },
  ENTERTAINMENT: { label: 'Entertainment', icon: 'film', color: '#a855f7', isExpense: true },
  SHOPPING: { label: 'Shopping', icon: 'bag', color: '#ec4899', isExpense: true },
  BILLS: { label: 'Bills & Utilities', icon: 'receipt', color: '#64748b', isExpense: true },
  HEALTH: { label: 'Health & Fitness', icon: 'heart', color: '#ef4444', isExpense: true },
  SUBSCRIPTIONS: { label: 'Subscriptions', icon: 'refresh', color: '#8b5cf6', isExpense: true },
  TRANSFERS: { label: 'Transfers', icon: 'swap-horizontal', color: '#06b6d4', isExpense: false },
  INCOME: { label: 'Income', icon: 'cash', color: '#10b981', isExpense: false },
  ATM: { label: 'Cash & ATM', icon: 'cash-outline', color: '#f59e0b', isExpense: true },
  OTHER: { label: 'Other', icon: 'ellipsis-horizontal', color: '#94a3b8', isExpense: true },
} as const;

export type TransactionCategory = keyof typeof TRANSACTION_CATEGORIES;

export const CATEGORY_LIST = Object.entries(TRANSACTION_CATEGORIES).map(([key, value]) => ({
  key: key as TransactionCategory,
  ...value,
}));

export const EXPENSE_CATEGORIES = CATEGORY_LIST.filter((c) => c.isExpense);
export const NON_EXPENSE_CATEGORIES = CATEGORY_LIST.filter((c) => !c.isExpense);
