import { useQuery } from '@tanstack/react-query';
import { recurringApi } from '@/lib/api';
import type { RecurringData } from '@/components/finance/RecurringCard';

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      const res = await recurringApi.list();
      return res.data as RecurringData[];
    },
  });
}
