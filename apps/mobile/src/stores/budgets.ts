import { create } from 'zustand';
import type { Budget } from '@clearmoney/shared';

interface BudgetsState {
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
}

export const useBudgetsStore = create<BudgetsState>((set) => ({
  budgets: [],
  setBudgets: (budgets) => set({ budgets }),
}));
