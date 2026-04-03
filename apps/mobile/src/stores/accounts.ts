import { create } from 'zustand';
import type { AccountWithBalance } from '@clearmoney/shared';

interface AccountsState {
  accounts: AccountWithBalance[];
  selectedAccountId: string | null;
  setAccounts: (accounts: AccountWithBalance[]) => void;
  selectAccount: (id: string | null) => void;
  totalBalance: () => number;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  selectedAccountId: null,
  setAccounts: (accounts) => set({ accounts }),
  selectAccount: (id) => set({ selectedAccountId: id }),
  totalBalance: () =>
    get().accounts.reduce((sum, a) => sum + (a.balance?.current ?? 0), 0),
}));
