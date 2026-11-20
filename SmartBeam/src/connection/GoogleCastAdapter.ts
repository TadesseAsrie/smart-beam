import { Cast, nativeAvailable, type CastRoute } from '../native';
import { ensureDiscoveryPermission } from '../services/permissions';
import { lanUrlFor, uploadToBackend } from '../services/hosting';
import type { Device, PresentContent, RemoteCommand, RemoteState } from '../types';
import { SmartBeamError, withTimeout } from '../utils/errors';
import { Emitter, type AdapterSupport, type ConnectionAdapter } from './types';

const toDevice = (r: CastRoute): Device => ({
  id: r.id,
  adapterId: 'google-cast',
  name: r.name,
  description: r.description || undefined,
  model: r.model || undefined,
  protocol: 'Google Cast',
  capabilities: ['video', 'image', 'slides', 'remote-control', 'pointer', 'blackout'],
  state: r.connectionState === 2 ? 'connected' : r.connectionState === 1 ? 'connecting' : 'available'
});

export class GoogleCastAdapter implements ConnectionAdapter {
  readonly id = 'google-cast' as const;
  readonly label = 'Google Cast';
  readonly protocol = 'Google Cast';
  readonly requirement = 'A Chromecast, Google TV or Cast-enabled projector/TV on the same Wi-Fi network. PDF/PowerPoint need the SmartBeam custom receiver.';
  readonly programmaticConnect = true;

  private remote = new Emitter<RemoteState>();
  private subs: (() => void)[] = [];
  private sessionSub: (() => void) | null = null;
  private lastKind: PresentContent['kind'] | null = null;

  async checkSupport(): Promise<AdapterSupport> {
    if (!nativeAvailable) return { supported: false, reason: 'The SmartBeam native module is missing. Install the Android development build (Expo Go is not supported).' };
    const cfg = await Cast.getConfig();
    if (!cfg.playServices) return { supported: false, reason: 'Google Play services is missing or out of date on this phone.' };
    return { supported: true };
  }

  async startDiscovery(cb: (d: Device[]) => void): Promise<void> {
    await ensureDiscoveryPermission();
    this.subs.push(Cast.onDevices((list) => cb(list.map(toDevice))));
    await Cast.startDiscovery();
  }

  async stopDiscovery(): Promise<void> {
    this.subs.splice(0).forEach((u) => u());
    await Cast.stopDiscovery().catch(() => undefined);
  }

  async connect(device: Device, onLost: (reason: string) => void): Promise<void> {
    let unsub: () => void = () => undefined;
    const established = new Promise<void>((resolve, reject) => {
      unsub = Cast.onSession((e) => {
        if (e.state === 'connected') resolve();
        else if (e.state === 'error') reject(new SmartBeamError('CAST_START_FAILED', e.message ?? 'The receiver refused the connection.'));
      });
    });
    try {
      await Cast.connect(device.id);
      await withTimeout(established, 20000, 'Connection timed out. Make sure the projector is on and on the same Wi-Fi network.');
    } finally {
      unsub();
    }
    this.sessionSub?.();
    this.sessionSub = Cast.onSession((e) => {
      if (e.state === 'disconnected' || e.state === 'error') onLost(e.message ?? 'The receiver disconnected.');
      if (e.state === 'suspended') onLost('Connection to the receiver was interrupted.');
    });
    this.subs.push(
      Cast.onMessage((json) => {
        try {
          const m = JSON.parse(json);
          if (m.type === 'STATE') this.remote.emit({ page: m.page, total: m.total });
          if (m.type === 'ERROR') this.remote.emit({ error: String(m.message ?? 'The receiver could not show this content.') });
        } catch { /* ignore malformed message */ }
      }),
      Cast.onMedia((v) => this.remote.emit({ video: v }))
    );
  }

  async disconnect(): Promise<void> {
    this.sessionSub?.(); this.sessionSub = null;
    this.subs.splice(0).forEach((u) => u());
    await Cast.disconnect().catch(() => undefined);
  }

  async present(c: PresentContent): Promise<void> {
    this.lastKind = c.kind;
    if (c.kind === 'video' || c.kind === 'image') {
      const url = await lanUrlFor(c.path, c.mime);
      await Cast.loadMedia(url, c.mime, c.title, 0);
      return;
    }
    const cfg = await Cast.getConfig();
    if (cfg.isDefaultReceiver) {
      throw new SmartBeamError(
        'RECEIVER_REQUIRED',
        'Google Cast cannot display PDF or PowerPoint on its own. Register the SmartBeam custom receiver (see README) and rebuild with SMARTBEAM_CAST_APP_ID, or use an external display / cloud room.'
      );
    }
    const name = c.title.endsWith('.pdf') ? c.title : c.title + '.pdf';
    const hosted = await uploadToBackend({ id: c.fileId, name, path: c.path, mime: 'application/pdf' });
    await Cast.sendMessage(JSON.stringify({ type: 'LOAD', kind: 'pdf', url: hosted.url, page: c.page, title: c.title }));
  }

  async send(cmd: RemoteCommand): Promise<void> {
    if (cmd.type === 'video' || (this.lastKind === 'video' && (cmd.type === 'pause' || cmd.type === 'resume'))) {
      const action = cmd.type === 'video' ? cmd.action : cmd.type === 'pause' ? 'pause' : 'play';
      await Cast.mediaControl(action, cmd.type === 'video' ? cmd.value ?? 0 : 0);
      return;
    }
    if (cmd.type === 'exit') { await this.stop(); return; }
    if (this.lastKind === 'image') return; // nothing to navigate on a single image
    await Cast.sendMessage(JSON.stringify({ type: 'COMMAND', command: cmd }));
  }

  async stop(): Promise<void> {
    await Cast.sendMessage(JSON.stringify({ type: 'EXIT' })).catch(() => undefined);
    await Cast.mediaControl('stop').catch(() => undefined);
    this.lastKind = null;
  }

  onRemoteState(cb: (s: RemoteState) => void): () => void { return this.remote.on(cb); }
}
