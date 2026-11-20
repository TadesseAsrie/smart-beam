import { useConnection } from '../store/connection';
import { useSettings } from '../store/settings';
import type { AdapterId, Device, RemoteState } from '../types';
import { SmartBeamError, reportError, userMessage } from '../utils/errors';
import type { ConnectionAdapter } from './types';

type LostListener = (reason: string) => void;

export class ConnectionManager {
  private adapters = new Map<AdapterId, ConnectionAdapter>();
  private activeAdapter: ConnectionAdapter | null = null;
  private discovering = new Set<AdapterId>();
  private lostListeners = new Set<LostListener>();
  private remoteListeners = new Set<(s: RemoteState) => void>();
  private remoteUnsub: (() => void) | null = null;

  register(a: ConnectionAdapter): void { this.adapters.set(a.id, a); }
  list(): ConnectionAdapter[] { return [...this.adapters.values()]; }
  get(id: AdapterId): ConnectionAdapter | undefined { return this.adapters.get(id); }
  current(): ConnectionAdapter | null { return this.activeAdapter; }
  onLost(cb: LostListener): () => void { this.lostListeners.add(cb); return () => this.lostListeners.delete(cb); }
  onRemoteState(cb: (s: RemoteState) => void): () => void { this.remoteListeners.add(cb); return () => this.remoteListeners.delete(cb); }

  /** Checks every adapter and records why one is unavailable, so the UI can say so honestly. */
  async refreshSupport(): Promise<void> {
    const unsupported: Partial<Record<AdapterId, string>> = {};
    for (const a of this.adapters.values()) {
      try {
        const s = await a.checkSupport();
        if (!s.supported) unsupported[a.id] = s.reason ?? 'Not supported on this device.';
      } catch (e) { unsupported[a.id] = userMessage(e); }
    }
    useConnection.getState().patch({ unsupported });
  }

  async startDiscovery(only?: AdapterId[]): Promise<void> {
    const st = useConnection.getState();
    await this.refreshSupport();
    const unsupported = useConnection.getState().unsupported;
    st.patch({ status: st.active ? 'connected' : 'discovering', error: null });
    await Promise.all(this.list().filter((a) => !only || only.includes(a.id)).map(async (a) => {
      if (unsupported[a.id] || this.discovering.has(a.id)) return;
      this.discovering.add(a.id);
      try {
        await a.startDiscovery((devices) => {
          const active = useConnection.getState().active;
          useConnection.getState().setDevices(a.id, devices.map((d) => (active && active.id === d.id ? { ...d, state: 'connected' } : d)));
        });
      } catch (e) {
        this.discovering.delete(a.id);
        useConnection.getState().patch({ unsupported: { ...useConnection.getState().unsupported, [a.id]: userMessage(e) } });
      }
    }));
  }

  async stopDiscovery(): Promise<void> {
    await Promise.all([...this.discovering].map((id) => this.adapters.get(id)?.stopDiscovery().catch(() => undefined)));
    this.discovering.clear();
    const st = useConnection.getState();
    if (st.status === 'discovering') st.patch({ status: st.active ? 'connected' : 'idle' });
  }

  async connect(device: Device): Promise<void> {
    const adapter = this.adapters.get(device.adapterId);
    if (!adapter) throw new SmartBeamError('NO_ADAPTER', 'Unknown connection type.');
    const store = useConnection.getState();
    if (this.activeAdapter) await this.disconnect();
    store.patch({ status: 'connecting', error: null });
    try {
      await adapter.connect(device, (reason) => this.handleLost(reason));
    } catch (e) {
      if (e instanceof SmartBeamError && e.code === 'GUIDANCE_ONLY') {
        store.patch({ status: 'guidance', error: null });
        throw e;
      }
      store.patch({ status: 'error', error: userMessage(e), active: null });
      throw e;
    }
    this.activeAdapter = adapter;
    this.remoteUnsub?.();
    this.remoteUnsub = adapter.onRemoteState((s) => this.remoteListeners.forEach((l) => l(s)));
    const connected: Device = { ...device, state: 'connected' };
    store.patch({ status: 'connected', active: connected, error: null });
    useConnection.getState().setDevices(adapter.id, useConnection.getState().devices.filter((d) => d.adapterId === adapter.id).map((d) => (d.id === device.id ? connected : d)));
    useSettings.getState().set({ lastDevice: { id: device.id, adapterId: device.adapterId, name: device.name } });
  }

  async disconnect(): Promise<void> {
    const a = this.activeAdapter;
    this.activeAdapter = null;
    this.remoteUnsub?.(); this.remoteUnsub = null;
    if (a) await a.disconnect().catch((e) => reportError(e, { toast: false, context: 'disconnect' }));
    const st = useConnection.getState();
    st.patch({ status: 'idle', active: null, error: null, devices: st.devices.map((d) => (d.state === 'connected' ? { ...d, state: 'available' } : d)) });
  }

  private handleLost(reason: string): void {
    if (!this.activeAdapter) return;
    const a = this.activeAdapter;
    this.activeAdapter = null;
    this.remoteUnsub?.(); this.remoteUnsub = null;
    a.disconnect().catch(() => undefined);
    const st = useConnection.getState();
    st.patch({ status: 'error', active: null, error: reason, devices: st.devices.map((d) => (d.state === 'connected' ? { ...d, state: 'available' } : d)) });
    this.lostListeners.forEach((l) => l(reason));
  }

  /** Re-connects to the last used device if it is discovered again (never fakes a connection). */
  async autoReconnect(timeoutMs = 12000): Promise<boolean> {
    const { autoReconnect, lastDevice } = useSettings.getState();
    if (!autoReconnect || !lastDevice || this.activeAdapter) return false;
    const adapter = this.adapters.get(lastDevice.adapterId);
    if (!adapter || !adapter.programmaticConnect) return false;
    await this.startDiscovery([lastDevice.adapterId]);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const d = useConnection.getState().devices.find((x) => x.id === lastDevice.id);
      if (d) {
        try { await this.connect(d); await this.stopDiscovery(); return true; } catch { await this.stopDiscovery(); return false; }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await this.stopDiscovery();
    return false;
  }
}

export const connectionManager = new ConnectionManager();
