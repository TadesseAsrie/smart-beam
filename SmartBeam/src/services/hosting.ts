import { Platform } from 'react-native';
import { LanServer } from '../native';
import { useSettings } from '../store/settings';
import { SmartBeamError } from '../utils/errors';
import { joinUrl } from '../utils/http';
import { requestUploadConsent } from './consent';

export interface HostedContent { id: string; url: string; pdfUrl?: string; notes?: string[]; expiresAt: number; server: string }

const hosted: HostedContent[] = [];

function backend(): { url: string; key: string } {
  const { backendUrl, backendKey } = useSettings.getState();
  if (!backendUrl) {
    throw new SmartBeamError('BACKEND_NOT_CONFIGURED', 'This needs the optional SmartBeam server. Add its address in Settings → Privacy & Server.');
  }
  return { url: backendUrl, key: backendKey };
}

export function hasBackend(): boolean { return !!useSettings.getState().backendUrl; }

/** Serves a local file on the Wi-Fi network under a one-time token (for Cast video / images). */
export async function lanUrlFor(path: string, mime: string): Promise<string> {
  await LanServer.start();
  return LanServer.registerFile(path, mime);
}

export interface UploadFile { id: string; name: string; path: string; mime: string }

/** Uploads a file to the optional backend after explicit consent. Returns a temporary HTTPS URL. */
export async function uploadToBackend(file: UploadFile, opts: { convert?: boolean; server?: { url: string; key?: string } } = {}): Promise<HostedContent> {
  const cfg = opts.server ? { url: opts.server.url, key: opts.server.key ?? '' } : backend();
  const host = cfg.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const ok = await requestUploadConsent(file.name, host, file.id);
  if (!ok) throw new SmartBeamError('USER_CANCELLED', 'Upload cancelled. Nothing was sent.');

  const form = new FormData();
  form.append('file', { uri: Platform.OS === 'android' ? 'file://' + file.path : file.path, name: file.name, type: file.mime } as unknown as Blob);
  if (opts.convert) form.append('convert', '1');
  let res: Response;
  try {
    res = await fetch(joinUrl(cfg.url, '/api/content'), { method: 'POST', body: form, headers: cfg.key ? { 'x-smartbeam-key': cfg.key } : {} });
  } catch {
    throw new SmartBeamError('NETWORK', 'Could not reach the SmartBeam server. Check your internet connection and the server address.');
  }
  if (!res.ok) {
    let msg = `Upload failed (${res.status}).`;
    try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
    throw new SmartBeamError('UPLOAD_FAILED', msg);
  }
  const j = (await res.json()) as { id: string; url: string; pdfUrl?: string; notes?: string[]; expiresAt: number };
  const h: HostedContent = { ...j, server: cfg.url };
  hosted.push(h);
  return h;
}

/** Deletes every temporary upload made in this session (best effort; the server also expires them). */
export async function cleanupHosted(): Promise<void> {
  const items = hosted.splice(0, hosted.length);
  await Promise.all(items.map((h) => fetch(joinUrl(h.server, `/api/content/${h.id}`), {
    method: 'DELETE', headers: useSettings.getState().backendKey ? { 'x-smartbeam-key': useSettings.getState().backendKey } : {}
  }).catch(() => undefined)));
  await LanServer.stop().catch(() => undefined);
}

export function hostedCount(): number { return hosted.length; }
