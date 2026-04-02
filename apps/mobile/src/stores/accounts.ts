import { create } from 'zustand';
import type { Account } from '@clearmoney/shared';

interface AccountsState {
  accounts: Account[];
  selectedAccountId: string | null;
  setAccounts: (accounts: Account[]) => void;
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
