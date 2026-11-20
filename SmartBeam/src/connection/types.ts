import type { AdapterId, Device, PresentContent, RemoteCommand, RemoteState } from '../types';

export interface AdapterSupport { supported: boolean; reason?: string }

/**
 * Every wireless technology (Cast, Miracast guidance, Android Presentation displays, cloud rooms, and future
 * vendor SDKs) implements this interface. The rest of the app only talks to the ConnectionManager.
 */
export interface ConnectionAdapter {
  readonly id: AdapterId;
  readonly label: string;
  readonly protocol: string;
  /** Human-readable hardware / network requirement, shown in the UI. */
  readonly requirement: string;
  /** True when the app can programmatically connect (false for Miracast, which is system-level). */
  readonly programmaticConnect: boolean;
  checkSupport(): Promise<AdapterSupport>;
  startDiscovery(onDevices: (devices: Device[]) => void): Promise<void>;
  stopDiscovery(): Promise<void>;
  /** Resolves only when the link is REALLY established; rejects otherwise. */
  connect(device: Device, onLost: (reason: string) => void): Promise<void>;
  disconnect(): Promise<void>;
  present(content: PresentContent): Promise<void>;
  send(cmd: RemoteCommand): Promise<void>;
  /** Stop showing the current content but keep the connection. */
  stop(): Promise<void>;
  onRemoteState(cb: (s: RemoteState) => void): () => void;
}

export class Emitter<T> {
  private cbs = new Set<(v: T) => void>();
  on(cb: (v: T) => void): () => void { this.cbs.add(cb); return () => this.cbs.delete(cb); }
  emit(v: T): void { this.cbs.forEach((cb) => cb(v)); }
}
