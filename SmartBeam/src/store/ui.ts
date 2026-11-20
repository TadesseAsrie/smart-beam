import { create } from 'zustand';

export type ToastTone = 'info' | 'error' | 'success';
interface UiState {
  toast: { id: number; message: string; tone: ToastTone } | null;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

export const useUi = create<UiState>((set) => ({
  toast: null,
  show: (message, tone = 'info') => set({ toast: { id: Date.now(), message, tone } }),
  hide: () => set({ toast: null })
}));
