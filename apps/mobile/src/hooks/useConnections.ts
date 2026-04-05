import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionsApi, institutionsApi } from '@/lib/api';

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await connectionsApi.list();
      return res.data;
    },
  });
}

export function useInstitutions() {
  return useQuery({
    queryKey: ['institutions'],
    queryFn: async () => {
      const res = await institutionsApi.list();
      return res.data;
    },
  });
}

export function useConnectBank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (institutionId: string) => connectionsApi.create(institutionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDisconnectBank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) => connectionsApi.delete(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
