import { Display, nativeAvailable, System } from '../native';
import type { Device, PresentContent, RemoteCommand, RemoteState } from '../types';
import { SmartBeamError } from '../utils/errors';
import { Emitter, type AdapterSupport, type ConnectionAdapter } from './types';

export const MIRACAST_STEPS = [
  'Turn on the projector / TV and select its wireless display or "Screen mirroring" input.',
  'On your phone open Quick Settings and tap Smart View, Screen Cast or Cast (the name depends on the manufacturer).',
  'Choose the projector from the list and accept any prompt shown on the screen.',
  'Return to SmartBeam and present: the phone screen is mirrored at system level.'
];

/**
 * Miracast is a SYSTEM feature on Android. Apps cannot enumerate or connect to Miracast sinks without hidden
 * APIs, so this adapter only guides the user to the OS screen and never reports a connection it cannot verify.
 */
export class MiracastAdapter implements ConnectionAdapter {
  readonly id = 'miracast' as const;
  readonly label = 'Miracast (screen mirroring)';
  readonly protocol = 'Miracast / system screen mirroring';
  readonly requirement = 'A Miracast-capable projector/TV and a phone that offers Smart View / Screen Cast. Connection is made in Android Settings, not in this app.';
  readonly programmaticConnect = false;

  private remote = new Emitter<RemoteState>();
  private subs: (() => void)[] = [];

  async checkSupport(): Promise<AdapterSupport> {
    if (!nativeAvailable) return { supported: false, reason: 'The SmartBeam native module is missing (Expo Go is not supported).' };
    const info = await System.getWirelessDisplayInfo();
    if (!info.castSettingsAvailable) return { supported: false, reason: 'This device has no system wireless-display settings screen.' };
    return { supported: true };
  }

  async startDiscovery(cb: (d: Device[]) => void): Promise<void> {
    const emit = async () => {
      const info = await System.getWirelessDisplayInfo();
      cb([{
        id: 'miracast-system',
        adapterId: 'miracast',
        name: 'Android screen mirroring',
        description: info.externalDisplays > 0 ? 'A secondary display is currently detected by Android.' : 'No mirrored display detected yet. Connect in Android settings.',
        model: `${info.manufacturer} ${info.model}`,
        protocol: this.protocol,
        capabilities: ['system-mirror'],
        state: 'available',
        meta: { externalDisplays: String(info.externalDisplays), wifiDirect: String(info.wifiDirect) }
      }]);
    };
    await emit();
    this.subs.push(Display.onDisplays(() => { emit().catch(() => undefined); }));
  }

  async stopDiscovery(): Promise<void> { this.subs.splice(0).forEach((u) => u()); }

  async connect(): Promise<void> {
    await System.openWirelessSettings();
    throw new SmartBeamError('GUIDANCE_ONLY', 'Android\'s screen-mirroring settings were opened. Pick your projector there, then come back and present.');
  }

  async disconnect(): Promise<void> { /* the OS owns the connection */ }
  async present(_c: PresentContent): Promise<void> { throw new SmartBeamError('SYSTEM_LEVEL', 'The mirrored display is controlled by Android, not by SmartBeam.'); }
  async send(_cmd: RemoteCommand): Promise<void> { /* local viewer handles navigation; nothing to send */ }
  async stop(): Promise<void> { /* nothing */ }
  onRemoteState(cb: (s: RemoteState) => void): () => void { return this.remote.on(cb); }
}
