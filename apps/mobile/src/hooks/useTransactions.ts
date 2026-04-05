import { useInfiniteQuery } from '@tanstack/react-query';
import { transactionsApi, type TransactionFilters } from '@/lib/api';
import type { TransactionRowData } from '@/components/finance/TransactionRow';

export function useTransactions(filters?: Omit<TransactionFilters, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: ['transactions', filters],
    queryFn: async ({ pageParam }) => {
      const res = await transactionsApi.list({ ...filters, cursor: pageParam });
      return {
        transactions: res.data as TransactionRowData[],
        nextCursor: res.nextCursor,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
