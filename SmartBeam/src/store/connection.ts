import { create } from 'zustand';
import type { AdapterId, Device } from '../types';

export type ConnectionStatus = 'idle' | 'discovering' | 'connecting' | 'connected' | 'guidance' | 'error';

interface ConnectionState {
  status: ConnectionStatus;
  devices: Device[];
  active: Device | null;
  error: string | null;
  unsupported: Partial<Record<AdapterId, string>>;
  setDevices: (adapterId: AdapterId, devices: Device[]) => void;
  patch: (p: Partial<Omit<ConnectionState, 'patch' | 'setDevices'>>) => void;
}

export const useConnection = create<ConnectionState>((set) => ({
  status: 'idle',
  devices: [],
  active: null,
  error: null,
  unsupported: {},
  setDevices: (adapterId, devices) => set((s) => ({ devices: [...s.devices.filter((d) => d.adapterId !== adapterId), ...devices] })),
  patch: (p) => set(p)
}));
