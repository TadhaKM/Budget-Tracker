import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insightsApi } from '@/lib/api';
import type { InsightData } from '@/components/finance/InsightCard';

export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await insightsApi.list();
      return res.data as InsightData[];
    },
  });
}

export function useDismissInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => insightsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}
