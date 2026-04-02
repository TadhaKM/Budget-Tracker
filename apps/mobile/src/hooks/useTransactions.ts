import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useTransactionsStore } from '@/stores/transactions';
import type { TransactionListResponse, TransactionCategory } from '@clearmoney/shared';

export function useTransactions(category?: TransactionCategory | null) {
  const setTransactions = useTransactionsStore((s) => s.setTransactions);

  const params = new URLSearchParams();
  if (category) params.set('category', category);

  return useQuery({
    queryKey: ['transactions', category ?? 'all'],
    queryFn: async () => {
      const query = params.toString() ? `?${params}` : '';
      const data = await apiFetch<TransactionListResponse>(`/transactions${query}`);
      setTransactions(data.transactions);
      return data;
    },
  });
}
