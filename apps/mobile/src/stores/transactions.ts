import { create } from 'zustand';
import type { TransactionRowData } from '@/components/finance/TransactionRow';

interface TransactionsState {
  transactions: TransactionRowData[];
  filterCategory: string | null;
  searchQuery: string;
  setTransactions: (transactions: TransactionRowData[]) => void;
  appendTransactions: (transactions: TransactionRowData[]) => void;
  setFilterCategory: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  clear: () => void;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  filterCategory: null,
  searchQuery: '',
  setTransactions: (transactions) => set({ transactions }),
  appendTransactions: (newTxns) =>
    set({ transactions: [...get().transactions, ...newTxns] }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clear: () => set({ transactions: [], filterCategory: null, searchQuery: '' }),
}));
