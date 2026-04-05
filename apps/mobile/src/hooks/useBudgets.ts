import { useQuery } from '@tanstack/react-query';
import { budgetsApi } from '@/lib/api';
import { useBudgetsStore } from '@/stores/budgets';
import type { BudgetData } from '@/components/finance/BudgetProgressBar';

export function useBudgets() {
  const setBudgets = useBudgetsStore((s) => s.setBudgets);

  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const res = await budgetsApi.list();
      const budgets = res.data as BudgetData[];
      setBudgets(budgets);
      return budgets;
    },
  });
}
