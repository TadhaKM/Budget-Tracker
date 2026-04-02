import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useBudgetsStore } from '@/stores/budgets';
import type { Budget } from '@clearmoney/shared';

export function useBudgets() {
  const setBudgets = useBudgetsStore((s) => s.setBudgets);

  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const data = await apiFetch<{ budgets: Budget[] }>('/budgets');
      setBudgets(data.budgets);
      return data.budgets;
    },
  });
}
