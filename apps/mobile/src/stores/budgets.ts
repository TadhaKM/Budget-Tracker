import { create } from 'zustand';
import type { BudgetData } from '@/components/finance/BudgetProgressBar';

interface BudgetsState {
  budgets: BudgetData[];
  setBudgets: (budgets: BudgetData[]) => void;
}

export const useBudgetsStore = create<BudgetsState>((set) => ({
  budgets: [],
  setBudgets: (budgets) => set({ budgets }),
}));
