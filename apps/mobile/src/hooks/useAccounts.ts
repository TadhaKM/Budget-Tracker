import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/lib/api';
import { useAccountsStore } from '@/stores/accounts';
import type { AccountData } from '@/components/finance/AccountCard';

export function useAccounts() {
  const setAccounts = useAccountsStore((s) => s.setAccounts);

  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await accountsApi.list();
      const accounts = res.data as AccountData[];
      setAccounts(accounts);
      return accounts;
    },
  });
}
