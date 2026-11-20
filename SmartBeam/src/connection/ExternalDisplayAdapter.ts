import { Display, nativeAvailable, type NativeDisplay } from '../native';
import type { Device, PresentContent, RemoteCommand, RemoteState } from '../types';
import { SmartBeamError } from '../utils/errors';
import { Emitter, type AdapterSupport, type ConnectionAdapter } from './types';

const toDevice = (d: NativeDisplay): Device => ({
  id: 'display-' + d.id,
  adapterId: 'external-display',
  name: d.name || `Display ${d.id}`,
  description: `${d.width}×${d.height} secondary display`,
  protocol: 'Android Presentation API',
  capabilities: ['video', 'image', 'slides', 'remote-control', 'pointer', 'blackout'],
  state: 'available',
  meta: { displayId: String(d.id) }
});

/** HDMI / USB-C / wireless-registered secondary displays via the Android Presentation API. */
export class ExternalDisplayAdapter implements ConnectionAdapter {
  readonly id = 'external-display' as const;
  readonly label = 'External display';
  readonly protocol = 'Android Presentation API';
  readonly requirement = 'A wired (HDMI / USB-C DisplayPort) or system-registered wireless secondary display that Android exposes as a presentation display.';
  readonly programmaticConnect = true;

  private remote = new Emitter<RemoteState>();
  private subs: (() => void)[] = [];
  private current: PresentContent | null = null;
  private displayId: number | null = null;

  async checkSupport(): Promise<AdapterSupport> {
    return nativeAvailable ? { supported: true } : { supported: false, reason: 'The SmartBeam native module is missing (Expo Go is not supported).' };
  }

  async startDiscovery(cb: (d: Device[]) => void): Promise<void> {
    this.subs.push(Display.onDisplays((l) => cb(l.map(toDevice))));
    cb((await Display.getDisplays()).map(toDevice));
  }

  async stopDiscovery(): Promise<void> { this.subs.splice(0).forEach((u) => u()); }

  async connect(device: Device, onLost: (reason: string) => void): Promise<void> {
    const id = Number(device.meta?.displayId);
    await Display.show(id);
    this.displayId = id;
    this.subs.push(
      Display.onLost((lost) => { if (lost === id) onLost('The external display was disconnected.'); }),
      Display.onVideo((v) => this.remote.emit({ video: v }))
    );
  }

  async disconnect(): Promise<void> {
    this.subs.splice(0).forEach((u) => u());
    this.current = null; this.displayId = null;
    await Display.dismiss().catch(() => undefined);
  }

  async present(c: PresentContent): Promise<void> {
    this.current = c;
    await Display.setBlackout(false);
    await Display.setPaused(false);
    if (c.kind === 'pdf') await Display.showPdf(c.path, c.page - 1);
    else if (c.kind === 'image') await Display.showImage(c.path);
    else await Display.playVideo(c.path);
  }

  async send(cmd: RemoteCommand): Promise<void> {
    if (!this.current) throw new SmartBeamError('NOTHING_PRESENTED', 'Nothing is being shown on the display.');
    switch (cmd.type) {
      case 'goto': if (this.current.kind === 'pdf') { await Display.showPdf(this.current.path, cmd.page - 1); this.current = { ...this.current, page: cmd.page }; } break;
      case 'pause': if (this.current.kind === 'video') await Display.videoControl('pause'); await Display.setPaused(true); break;
      case 'resume': if (this.current.kind === 'video') await Display.videoControl('play'); await Display.setPaused(false); break;
      case 'blackout': await Display.setBlackout(cmd.on); break;
      case 'pointer': await Display.setPointer(cmd.x, cmd.y, cmd.visible); break;
      case 'video': await Display.videoControl(cmd.action, cmd.value ?? 0); break;
      case 'exit': await this.stop(); break;
    }
  }

  async stop(): Promise<void> { this.current = null; await Display.clear().catch(() => undefined); }

  onRemoteState(cb: (s: RemoteState) => void): () => void { return this.remote.on(cb); }
}
