import { useUi } from '../store/ui';

export class SmartBeamError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SmartBeamError';
    this.code = code;
  }
}

const FRIENDLY: Record<string, string> = {
  NO_ROUTE: 'That receiver is no longer available. Refresh the list and try again.',
  NO_SESSION: 'There is no active connection to the receiver.',
  NO_LAN: 'Connect your phone to the same Wi-Fi network as the receiver.',
  PDF_OPEN_FAILED: 'This PDF could not be opened. It may be damaged or password protected.'
};

export function userMessage(e: unknown): string {
  if (e instanceof SmartBeamError) return e.message;
  const anyE = e as { code?: string; message?: string };
  if (anyE?.code && FRIENDLY[anyE.code]) return FRIENDLY[anyE.code];
  return anyE?.message || 'Something went wrong. Please try again.';
}

export function isCancel(e: unknown): boolean {
  const c = (e as { code?: string })?.code;
  return c === 'E_CANCELLED' || c === 'DOCUMENT_PICKER_CANCELED' || c === 'OPERATION_CANCELED' || c === 'USER_CANCELLED';
}

/** Single place where errors are logged and (optionally) surfaced to the user. */
export function reportError(e: unknown, opts: { toast?: boolean; context?: string } = {}): string {
  const message = userMessage(e);
  if (!isCancel(e)) {
    // eslint-disable-next-line no-console
    console.warn(`[SmartBeam${opts.context ? ':' + opts.context : ''}]`, e);
    if (opts.toast !== false) useUi.getState().show(message, 'error');
  }
  return message;
}

export function withTimeout<T>(p: Promise<T>, ms: number, message: string, code = 'TIMEOUT'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new SmartBeamError(code, message)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

type Handler = (e: Error, fatal?: boolean) => void;

export function installGlobalErrorHandler(): void {
  const eu = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void } }).ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((error, isFatal) => {
    // eslint-disable-next-line no-console
    console.error('[SmartBeam:global]', isFatal ? 'FATAL' : 'non-fatal', error);
    if (!isFatal) useUi.getState().show(userMessage(error), 'error');
    else prev?.(error, isFatal);
  });
}
