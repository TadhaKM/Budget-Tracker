import { create } from 'zustand';
import type { AccountData } from '@/components/finance/AccountCard';

interface AccountsState {
  accounts: AccountData[];
  selectedAccountId: string | null;
  setAccounts: (accounts: AccountData[]) => void;
  selectAccount: (id: string | null) => void;
  totalBalance: () => number;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  selectedAccountId: null,
  setAccounts: (accounts) => set({ accounts }),
  selectAccount: (id) => set({ selectedAccountId: id }),
  totalBalance: () => get().accounts.reduce((sum, a) => sum + a.balance, 0),
}));
