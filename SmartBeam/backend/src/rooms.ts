import crypto from 'node:crypto';

export interface RoomState {
  content: { kind: string; url: string; title: string; mime?: string } | null;
  page: number; paused: boolean; blackout: boolean; pointer: { x: number; y: number; visible: boolean };
  video?: { action: string; value: number; nonce: number };
}
interface Room { id: string; key: string; receiverToken: string; state: RoomState; version: number; lastSeen: number; touched: number; waiters: Array<() => void> }

const emptyState = (): RoomState => ({ content: null, page: 1, paused: false, blackout: false, pointer: { x: 0.5, y: 0.5, visible: false } });
const rand = (n: number) => crypto.randomBytes(n).toString('base64url');

export class RoomStore {
  private rooms = new Map<string, Room>();
  constructor(private idleMs = 4 * 3600_000, private onlineMs = 15_000) {}

  create() {
    const r: Room = { id: rand(6), key: rand(18), receiverToken: rand(18), state: emptyState(), version: 1, lastSeen: Date.now(), touched: Date.now(), waiters: [] };
    this.rooms.set(r.id, r);
    return { id: r.id, key: r.key, receiverToken: r.receiverToken };
  }

  info(id: string) { const r = this.rooms.get(id); return r ? { id: r.id, online: Date.now() - r.lastSeen < this.onlineMs } : null; }

  private authed(id: string, key: string): Room | null {
    const r = this.rooms.get(id);
    if (!r) return null;
    const a = Buffer.from(r.key), b = Buffer.from(String(key ?? ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? r : null;
  }

  patch(id: string, key: string, patch: Partial<RoomState>): boolean {
    const r = this.authed(id, key);
    if (!r) return false;
    const next: RoomState = { ...r.state };
    for (const k of ['content', 'page', 'paused', 'blackout', 'pointer', 'video'] as const) if (k in patch) (next as any)[k] = (patch as any)[k];
    if (next.content === null) Object.assign(next, { page: 1, paused: false, blackout: false });
    r.state = next; r.version++; r.touched = Date.now();
    const w = r.waiters.splice(0); w.forEach((f) => f());
    return true;
  }

  /** Long-poll for the receiver. Marks the room online. */
  poll(id: string, receiverToken: string, since: number, timeoutMs = 20_000): Promise<{ version: number; changed: boolean; state: RoomState } | null> {
    const r = this.rooms.get(id);
    if (!r || r.receiverToken !== receiverToken) return Promise.resolve(null);
    r.lastSeen = Date.now();
    if (r.version !== since) return Promise.resolve({ version: r.version, changed: true, state: r.state });
    return new Promise((resolve) => {
      const done = () => { clearTimeout(t); r.lastSeen = Date.now(); resolve({ version: r.version, changed: r.version !== since, state: r.state }); };
      const t = setTimeout(() => { const i = r.waiters.indexOf(done); if (i >= 0) r.waiters.splice(i, 1); done(); }, timeoutMs);
      r.waiters.push(done);
    });
  }

  sweep(now = Date.now()) { for (const [id, r] of this.rooms) if (now - r.touched > this.idleMs && now - r.lastSeen > this.idleMs) this.rooms.delete(id); }
  size() { return this.rooms.size; }
}
