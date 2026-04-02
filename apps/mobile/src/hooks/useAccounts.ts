import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAccountsStore } from '@/stores/accounts';
import type { AccountListResponse } from '@clearmoney/shared';

export function useAccounts() {
  const setAccounts = useAccountsStore((s) => s.setAccounts);

  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const data = await apiFetch<AccountListResponse>('/accounts');
      setAccounts(data.accounts);
      return data.accounts;
    },
  });
}
