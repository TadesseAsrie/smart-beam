jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-blob-util', () => ({ __esModule: true, default: { fs: { exists: async () => true, stat: async () => ({ size: 1 }), dirs: { DocumentDir: '/doc' } }, config: () => ({ fetch: async () => ({}) }) } }));
jest.mock('../src/native', () => ({
  nativeAvailable: true,
  PdfNative: { pageCount: jest.fn(async () => 12) },
  Files: { deleteFile: jest.fn(async () => true) },
  LanServer: { stop: jest.fn(async () => true) }
}));
jest.mock('../src/db/repositories', () => ({
  historyRepo: { upsert: jest.fn(async () => undefined), setFavoriteForFile: jest.fn(), list: jest.fn(async () => []), remove: jest.fn(), clear: jest.fn() },
  filesRepo: { update: jest.fn(async () => undefined), list: jest.fn(async () => []), remove: jest.fn(), insert: jest.fn(), clearFolder: jest.fn() },
  foldersRepo: { list: jest.fn(async () => []) },
  conversionsRepo: { get: jest.fn(async () => null), put: jest.fn(), list: jest.fn(async () => []), clear: jest.fn() }
}));

import { ConnectionManager } from '../src/connection/ConnectionManager';
import { Emitter, type ConnectionAdapter } from '../src/connection/types';
import { SmartBeamError } from '../src/utils/errors';
import { parseRoomQr } from '../src/connection/CloudRoomAdapter';
import { useConnection } from '../src/store/connection';
import { usePresentation } from '../src/store/presentation';
import type { Device, FileRecord, PresentContent, RemoteCommand } from '../src/types';

const device: Device = { id: 'd1', adapterId: 'google-cast', name: 'Room 12', protocol: 'Google Cast', capabilities: ['slides'], state: 'available' };
const file: FileRecord = { id: 'f1', name: 'deck.pdf', ext: 'pdf', kind: 'pdf', path: '/files/deck.pdf', mime: 'application/pdf', size: 1, modifiedAt: 1, importedAt: 1, folderId: null, favorite: false, lastOpenedAt: null };

class FakeAdapter implements ConnectionAdapter {
  id = 'google-cast' as const; label = 'Fake'; protocol = 'Fake'; requirement = ''; programmaticConnect = true;
  presented: PresentContent[] = []; sent: RemoteCommand[] = []; failConnect: Error | null = null; remote = new Emitter<any>(); lost: ((r: string) => void) | null = null;
  async checkSupport() { return { supported: true }; }
  async startDiscovery(cb: (d: Device[]) => void) { cb([device]); }
  async stopDiscovery() {}
  async connect(_d: Device, onLost: (r: string) => void) { if (this.failConnect) throw this.failConnect; this.lost = onLost; }
  async disconnect() {}
  async present(c: PresentContent) { this.presented.push(c); }
  async send(c: RemoteCommand) { this.sent.push(c); }
  async stop() {}
  onRemoteState(cb: (s: any) => void) { return this.remote.on(cb); }
}

describe('ConnectionManager', () => {
  it('never reports connected when the adapter fails', async () => {
    const m = new ConnectionManager(); const a = new FakeAdapter(); a.failConnect = new SmartBeamError('TIMEOUT', 'Connection timed out');
    m.register(a);
    await expect(m.connect(device)).rejects.toThrow('timed out');
    expect(useConnection.getState().status).toBe('error');
    expect(useConnection.getState().active).toBeNull();
  });

  it('treats Miracast-style guidance as unverified, not connected', async () => {
    const m = new ConnectionManager(); const a = new FakeAdapter(); a.failConnect = new SmartBeamError('GUIDANCE_ONLY', 'opened settings');
    m.register(a);
    await expect(m.connect(device)).rejects.toThrow();
    expect(useConnection.getState().status).toBe('guidance');
    expect(useConnection.getState().active).toBeNull();
  });

  it('reports a lost connection', async () => {
    const m = new ConnectionManager(); const a = new FakeAdapter(); m.register(a);
    await m.connect(device);
    expect(useConnection.getState().status).toBe('connected');
    const seen: string[] = []; m.onLost((r) => seen.push(r));
    a.lost!('Display unplugged');
    expect(useConnection.getState().status).toBe('error');
    expect(seen).toEqual(['Display unplugged']);
  });
});

describe('presentation controller', () => {
  it('presents, navigates, pauses and exits through the active adapter', async () => {
    jest.resetModules();
    const { ConnectionManager: CM } = require('../src/connection/ConnectionManager');
    const mgrModule = require('../src/connection');
    const a = new FakeAdapter();
    mgrModule.connectionManager.register(a);
    const ctrl = require('../src/presentation/controller');
    const { useConnection: uc } = require('../src/store/connection');
    const { usePresentation: up } = require('../src/store/presentation');
    expect(CM).toBeDefined();
    await mgrModule.connectionManager.connect(device);
    await ctrl.openPresentation(file, { startPage: 2 });
    expect(up.getState().status).toBe('live');
    expect(up.getState().total).toBe(12);
    expect(a.presented[0]).toMatchObject({ kind: 'pdf', page: 2, totalPages: 12 });
    expect(up.getState().outputMode).toBe('external');

    ctrl.nextSlide(); ctrl.goTo(99); ctrl.prevSlide();
    expect(a.sent).toEqual([{ type: 'goto', page: 3 }, { type: 'goto', page: 12 }, { type: 'goto', page: 11 }]);

    ctrl.pause(); ctrl.goTo(1);
    expect(up.getState().page).toBe(11); // navigation is locked while paused
    ctrl.resume(); ctrl.setBlackout(true);
    expect(a.sent.slice(-2)).toEqual([{ type: 'resume' }, { type: 'blackout', on: true }]);

    await ctrl.exitPresentation();
    expect(a.sent[a.sent.length - 1]).toEqual({ type: 'exit' });
    expect(up.getState().status).toBe('idle');
    expect(uc.getState().active).not.toBeNull(); // exiting a presentation keeps the connection
  });

  it('falls back to local output (with a reason) when the adapter rejects the content', async () => {
    jest.resetModules();
    const mgrModule = require('../src/connection');
    const a = new FakeAdapter(); a.present = async () => { throw new SmartBeamError('RECEIVER_REQUIRED', 'Custom receiver required'); };
    mgrModule.connectionManager.register(a);
    const ctrl = require('../src/presentation/controller');
    const { usePresentation: up } = require('../src/store/presentation');
    await mgrModule.connectionManager.connect(device);
    await ctrl.openPresentation(file);
    expect(up.getState().outputMode).toBe('local');
    expect(up.getState().outputError).toMatch(/Custom receiver/);
    await ctrl.exitPresentation();
  });
});

describe('QR room parsing', () => {
  it('accepts a valid pairing code', () => {
    expect(parseRoomQr('smartbeam://room?server=https%3A%2F%2Fsb.example.com&id=abc123&key=0123456789abcdef')).toEqual({ server: 'https://sb.example.com', id: 'abc123', key: '0123456789abcdef' });
  });
  it('rejects foreign or malformed codes', () => {
    expect(parseRoomQr('https://evil.example.com')).toBeNull();
    expect(parseRoomQr('smartbeam://room?server=javascript%3Aalert(1)&id=abc123&key=0123456789abcdef')).toBeNull();
    expect(parseRoomQr('smartbeam://room?server=https%3A%2F%2Fa.b&id=x&key=short')).toBeNull();
  });
});
