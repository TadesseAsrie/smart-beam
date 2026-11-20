import { useSettings } from '../store/settings';
import { uploadToBackend } from '../services/hosting';
import type { Device, PairedRoom, PresentContent, RemoteCommand, RemoteState } from '../types';
import { SmartBeamError } from '../utils/errors';
import { fetchJson, joinUrl } from '../utils/http';
import { Emitter, type AdapterSupport, type ConnectionAdapter } from './types';

/** Parses smartbeam://room?server=<url-encoded>&id=<id>&key=<key> shown by the receiver page. */
export function parseRoomQr(text: string): Omit<PairedRoom, 'name'> | null {
  const m = /^smartbeam:\/\/room\?(.+)$/i.exec(text.trim());
  if (!m) return null;
  const q: Record<string, string> = {};
  for (const part of m[1].split('&')) {
    const i = part.indexOf('=');
    if (i > 0) q[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  if (!q.server || !q.id || !q.key) return null;
  if (!/^https?:\/\//.test(q.server) || !/^[A-Za-z0-9_-]{4,64}$/.test(q.id) || !/^[A-Za-z0-9_-]{8,128}$/.test(q.key)) return null;
  return { server: q.server.replace(/\/+$/, ''), id: q.id, key: q.key };
}

export const roomToDevice = (r: PairedRoom): Device => ({
  id: 'room-' + r.id,
  adapterId: 'cloud-room',
  name: r.name,
  description: r.server.replace(/^https?:\/\//, ''),
  protocol: 'SmartBeam cloud room (browser receiver)',
  capabilities: ['video', 'image', 'slides', 'remote-control', 'pointer', 'blackout'],
  state: 'available',
  meta: { roomId: r.id }
});

interface RoomState {
  content: { kind: string; url: string; title: string; mime: string } | null;
  page: number; paused: boolean; blackout: boolean; pointer: { x: number; y: number; visible: boolean };
  video?: { action: string; value: number; nonce: number };
}

/**
 * Pairs with any browser (smart TV, PC, projector's built-in browser) that opens the receiver page:
 * the page shows a QR code, the phone scans it, and both sides exchange state through the SmartBeam server.
 */
export class CloudRoomAdapter implements ConnectionAdapter {
  readonly id = 'cloud-room' as const;
  readonly label = 'Wireless Presentation (QR room)';
  readonly protocol = 'SmartBeam cloud room';
  readonly requirement = 'Any screen with a web browser that can open your SmartBeam server address, plus internet access on both devices.';
  readonly programmaticConnect = true;

  private remote = new Emitter<RemoteState>();
  private room: PairedRoom | null = null;
  private beat: ReturnType<typeof setInterval> | null = null;
  private misses = 0;
  private nonce = 0;

  async checkSupport(): Promise<AdapterSupport> { return { supported: true }; }

  async startDiscovery(cb: (d: Device[]) => void): Promise<void> { cb(useSettings.getState().pairedRooms.map(roomToDevice)); }
  async stopDiscovery(): Promise<void> { /* nothing running */ }

  private roomOf(device: Device): PairedRoom {
    const r = useSettings.getState().pairedRooms.find((x) => x.id === device.meta?.roomId);
    if (!r) throw new SmartBeamError('ROOM_UNKNOWN', 'This room is not paired any more. Scan its QR code again.');
    return r;
  }

  private async patch(patch: Partial<RoomState>): Promise<void> {
    if (!this.room) throw new SmartBeamError('NO_SESSION', 'Not connected to a room.');
    await fetchJson(joinUrl(this.room.server, `/api/rooms/${this.room.id}/state`), {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: this.room.key, patch })
    });
  }

  async connect(device: Device, onLost: (reason: string) => void): Promise<void> {
    const room = this.roomOf(device);
    const info = await fetchJson<{ online: boolean }>(joinUrl(room.server, `/api/rooms/${room.id}`), { timeoutMs: 8000 });
    if (!info.online) throw new SmartBeamError('RECEIVER_UNAVAILABLE', 'The receiver page is not open or is offline. Reload the page on the screen and scan the new QR code.');
    this.room = room;
    this.misses = 0;
    this.beat = setInterval(async () => {
      try {
        const r = await fetchJson<{ online: boolean }>(joinUrl(room.server, `/api/rooms/${room.id}`), { timeoutMs: 6000 });
        this.misses = r.online ? 0 : this.misses + 1;
      } catch { this.misses += 1; }
      if (this.misses >= 2) { this.clearBeat(); onLost('The receiver screen went offline.'); }
    }, 8000);
  }

  private clearBeat() { if (this.beat) clearInterval(this.beat); this.beat = null; }

  async disconnect(): Promise<void> {
    this.clearBeat();
    if (this.room) await this.patch({ content: null }).catch(() => undefined);
    this.room = null;
  }

  async present(c: PresentContent): Promise<void> {
    const name = c.kind === 'pdf' && !c.title.endsWith('.pdf') ? c.title + '.pdf' : c.title;
    const hosted = await uploadToBackend({ id: c.fileId, name, path: c.path, mime: c.mime }, { server: { url: this.room!.server, key: useSettings.getState().backendKey } });
    await this.patch({ content: { kind: c.kind, url: hosted.url, title: c.title, mime: c.mime }, page: c.page, paused: false, blackout: false, pointer: { x: 0.5, y: 0.5, visible: false } });
  }

  async send(cmd: RemoteCommand): Promise<void> {
    switch (cmd.type) {
      case 'goto': return this.patch({ page: cmd.page });
      case 'pause': return this.patch({ paused: true, video: { action: 'pause', value: 0, nonce: ++this.nonce } });
      case 'resume': return this.patch({ paused: false, video: { action: 'play', value: 0, nonce: ++this.nonce } });
      case 'blackout': return this.patch({ blackout: cmd.on });
      case 'pointer': return this.patch({ pointer: { x: cmd.x, y: cmd.y, visible: cmd.visible } });
      case 'video': return this.patch({ video: { action: cmd.action, value: cmd.value ?? 0, nonce: ++this.nonce } });
      case 'exit': return this.stop();
    }
  }

  async stop(): Promise<void> { if (this.room) await this.patch({ content: null }).catch(() => undefined); }

  onRemoteState(cb: (s: RemoteState) => void): () => void { return this.remote.on(cb); }
}
