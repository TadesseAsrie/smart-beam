import { SmartBeamError } from './errors';

export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error ?? ''; } catch { /* ignore */ }
      throw new SmartBeamError('HTTP_' + res.status, detail || `Server responded with ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof SmartBeamError) throw e;
    if ((e as Error).name === 'AbortError') throw new SmartBeamError('TIMEOUT', 'The server did not respond in time.');
    throw new SmartBeamError('NETWORK', 'Could not reach the server. Check your network connection.');
  } finally {
    clearTimeout(t);
  }
}

export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}
