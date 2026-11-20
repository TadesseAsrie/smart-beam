import { create } from 'zustand';
import type { FileRecord, VideoState } from '../types';

export type PresentationKind = 'pdf' | 'outline' | 'image' | 'video';
export type PresentationStatus = 'idle' | 'preparing' | 'live' | 'error';

export interface PresentationState {
  status: PresentationStatus;
  sessionId: string | null;
  file: FileRecord | null;
  kind: PresentationKind | null;
  /** Local path of the PDF/image/video that is actually being shown. */
  path: string | null;
  page: number;
  total: number;
  notes: string[];
  outline: string[][];
  warnings: string[];
  paused: boolean;
  blackout: boolean;
  pointer: { x: number; y: number; visible: boolean };
  elapsedBase: number;
  resumedAt: number | null;
  outputMode: 'external' | 'local' | 'mirror';
  outputError: string | null;
  video: VideoState;
  playlist: string[];
  patch: (p: Partial<Omit<PresentationState, 'patch' | 'reset'>>) => void;
  reset: () => void;
}

const initial = {
  status: 'idle' as PresentationStatus,
  sessionId: null,
  file: null,
  kind: null,
  path: null,
  page: 1,
  total: 1,
  notes: [] as string[],
  outline: [] as string[][],
  warnings: [] as string[],
  paused: false,
  blackout: false,
  pointer: { x: 0.5, y: 0.5, visible: false },
  elapsedBase: 0,
  resumedAt: null as number | null,
  outputMode: 'local' as const,
  outputError: null as string | null,
  video: { positionMs: 0, durationMs: 0, playing: false } as VideoState,
  playlist: [] as string[]
};

export const usePresentation = create<PresentationState>((set) => ({
  ...initial,
  patch: (p) => set(p),
  reset: () => set({ ...initial })
}));

export function elapsedSeconds(s: Pick<PresentationState, 'elapsedBase' | 'resumedAt'>, now = Date.now()): number {
  return s.elapsedBase + (s.resumedAt ? (now - s.resumedAt) / 1000 : 0);
}
