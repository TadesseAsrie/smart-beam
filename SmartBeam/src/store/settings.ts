import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdapterId, PairedRoom } from '../types';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type ConnectionPref = AdapterId | 'ask';

export interface LastDevice { id: string; adapterId: AdapterId; name: string }

export interface SettingsState {
  onboarded: boolean;
  theme: ThemeMode;
  orientation: Orientation;
  defaultConnection: ConnectionPref;
  autoReconnect: boolean;
  keepScreenOn: boolean;
  autoDeleteImportedAfterPresenting: boolean;
  backendUrl: string;
  backendKey: string;
  rememberHistory: boolean;
  lastDevice: LastDevice | null;
  pairedRooms: PairedRoom[];
  set: (patch: Partial<Omit<SettingsState, 'set' | 'addRoom' | 'removeRoom'>>) => void;
  addRoom: (r: PairedRoom) => void;
  removeRoom: (id: string) => void;
}

export const DEFAULT_SETTINGS = {
  onboarded: false,
  theme: 'system' as ThemeMode,
  orientation: 'auto' as Orientation,
  defaultConnection: 'ask' as ConnectionPref,
  autoReconnect: true,
  keepScreenOn: true,
  autoDeleteImportedAfterPresenting: false,
  backendUrl: '',
  backendKey: '',
  rememberHistory: true,
  lastDevice: null as LastDevice | null,
  pairedRooms: [] as PairedRoom[]
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      addRoom: (r) => set((s) => ({ pairedRooms: [r, ...s.pairedRooms.filter((x) => x.id !== r.id)].slice(0, 10) })),
      removeRoom: (id) => set((s) => ({ pairedRooms: s.pairedRooms.filter((x) => x.id !== id) }))
    }),
    { name: 'smartbeam-settings', storage: createJSONStorage(() => AsyncStorage), version: 1 }
  )
);
