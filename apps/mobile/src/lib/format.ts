/**
 * Formatting utilities used across the app.
 */

/** Format a number as currency (€). */
export function formatCurrency(amount: number, showSign = false): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (showSign && amount !== 0) {
    return amount > 0 ? `+€${formatted}` : `-€${formatted}`;
  }

  return `€${formatted}`;
}

/** Format a number as a compact value (e.g. €1.2k). */
export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `€${(amount / 1_000).toFixed(1)}k`;
  return formatCurrency(amount);
}

/** Format a percentage (e.g. 42.5%). */
export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

/** Format a date as "Mon 3 Apr". */
export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Format a date as "3 April 2025". */
export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Format a date as relative text ("Today", "Yesterday", "Mon"). */
export function formatRelativeDay(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-IE', { weekday: 'long' });
  return formatDateShort(d);
}

/** Capitalise first letter. */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Format a category ID into a display label. */
export function formatCategoryLabel(categoryId: string): string {
  return categoryId
    .split('_')
    .map((w) => capitalise(w))
    .join(' ');
}
