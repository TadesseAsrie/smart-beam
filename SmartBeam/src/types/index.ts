export type FileKind = 'pdf' | 'ppt' | 'doc' | 'image' | 'video';

export interface FileRecord {
  id: string;
  name: string;
  ext: string;
  kind: FileKind;
  /** Absolute path inside app-private storage (the app-managed copy). */
  path: string;
  mime: string;
  size: number;
  modifiedAt: number;
  importedAt: number;
  folderId: string | null;
  favorite: boolean;
  lastOpenedAt: number | null;
}

export interface Folder { id: string; name: string; createdAt: number }

export interface HistoryRecord {
  id: string;
  fileId: string;
  fileName: string;
  fileKind: FileKind;
  presentedAt: number;
  lastSlide: number;
  totalSlides: number;
  durationSec: number;
  favorite: boolean;
}

export type AdapterId = 'google-cast' | 'miracast' | 'external-display' | 'cloud-room';
export type Capability = 'slides' | 'video' | 'image' | 'pointer' | 'blackout' | 'remote-control' | 'system-mirror';
export type DeviceState = 'available' | 'connecting' | 'connected' | 'unavailable';

export interface Device {
  id: string;
  adapterId: AdapterId;
  name: string;
  description?: string;
  model?: string;
  protocol: string;
  capabilities: Capability[];
  state: DeviceState;
  meta?: Record<string, string>;
}

export type RemoteCommand =
  | { type: 'goto'; page: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'blackout'; on: boolean }
  | { type: 'pointer'; x: number; y: number; visible: boolean }
  | { type: 'video'; action: 'play' | 'pause' | 'seek' | 'stop' | 'volume'; value?: number }
  | { type: 'exit' };

export interface PresentContent {
  kind: 'pdf' | 'image' | 'video';
  path: string;
  mime: string;
  title: string;
  fileId: string;
  page: number;
  totalPages: number;
}

export interface VideoState { positionMs: number; durationMs: number; playing: boolean }
export interface RemoteState { page?: number; total?: number; video?: VideoState; error?: string }

export interface PairedRoom { id: string; key: string; server: string; name: string }
