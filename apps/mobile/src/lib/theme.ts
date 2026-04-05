/**
 * Design tokens — single source of truth for colours, spacing, typography.
 * NativeWind handles most styling via Tailwind classes, but these tokens are
 * needed when values must be passed as JS props (e.g. chart colours, icon tints).
 */

export const colors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceLight: '#334155',
  border: '#475569',

  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },

  text: {
    primary: '#f8fafc',   // slate-50
    secondary: '#94a3b8',  // slate-400
    muted: '#64748b',      // slate-500
    inverse: '#0F172A',
  },

  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',

  // Category colours — mirrors @clearmoney/shared TRANSACTION_CATEGORIES
  category: {
    GROCERIES: '#22c55e',
    DINING: '#f97316',
    TRANSPORT: '#3b82f6',
    ENTERTAINMENT: '#a855f7',
    SHOPPING: '#ec4899',
    BILLS: '#64748b',
    HEALTH: '#ef4444',
    SUBSCRIPTIONS: '#8b5cf6',
    TRANSFERS: '#06b6d4',
    INCOME: '#10b981',
    ATM: '#f59e0b',
    OTHER: '#94a3b8',
  } as Record<string, string>,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  heading: { fontSize: 24, fontWeight: '700' as const },
  subheading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 14, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
} as const;

/** MaterialIcons names mapped to each category. */
export const categoryIcons: Record<string, string> = {
  GROCERIES: 'shopping-cart',
  DINING: 'restaurant',
  TRANSPORT: 'directions-bus',
  ENTERTAINMENT: 'movie',
  SHOPPING: 'shopping-bag',
  BILLS: 'receipt',
  HEALTH: 'favorite',
  SUBSCRIPTIONS: 'autorenew',
  TRANSFERS: 'swap-horiz',
  INCOME: 'attach-money',
  ATM: 'local-atm',
  OTHER: 'more-horiz',
};
