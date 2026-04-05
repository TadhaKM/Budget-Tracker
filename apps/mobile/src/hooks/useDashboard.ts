import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { useDashboardStore } from '@/stores/dashboard';

export function useDashboard() {
  const setData = useDashboardStore((s) => s.setData);

  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await analyticsApi.dashboard();
      setData(res.data);
      return res.data;
    },
  });
}
