import { create } from 'zustand';
import type { DashboardResponse } from '@/lib/api';

interface DashboardState {
  data: DashboardResponse | null;
  setData: (data: DashboardResponse) => void;
  clear: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  setData: (data) => set({ data }),
  clear: () => set({ data: null }),
}));
