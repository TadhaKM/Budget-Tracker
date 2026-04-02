import { create } from 'zustand';
import type { Transaction, TransactionCategory } from '@clearmoney/shared';

interface TransactionsState {
  transactions: Transaction[];
  filterCategory: TransactionCategory | null;
  setTransactions: (transactions: Transaction[]) => void;
  setFilterCategory: (category: TransactionCategory | null) => void;
}

export const useTransactionsStore = create<TransactionsState>((set) => ({
  transactions: [],
  filterCategory: null,
  setTransactions: (transactions) => set({ transactions }),
  setFilterCategory: (category) => set({ filterCategory: category }),
}));
