/**
 * Lazy, crash-safe access to third-party native libraries.
 *
 * Importing a library whose native half is missing from the installed binary (stale dev client, failed autolink,
 * wrong architecture) throws at *import* time — e.g. "Cannot read property 'getConstants' of null" — and takes the
 * whole app down before any error boundary exists. Loading them on first use turns that into an ordinary,
 * catchable error for the one feature that needs them.
 */
import { SmartBeamError } from '../utils/errors';

function load<T>(name: string, feature: string, get: () => any): T {
  try {
    const m = get();
    return (m && m.__esModule ? m : m?.default ? m : { default: m }) as T;
  } catch (e) {
    throw new SmartBeamError('NATIVE_UNAVAILABLE', `${feature} is unavailable: the native module "${name}" is missing from this build. Rebuild the app (npx expo prebuild --clean, then npx expo run:android). ${(e as Error)?.message ?? ''}`.trim());
  }
}

export function blobUtil(): any {
  return load<{ default: any }>('react-native-blob-util', 'File access', () => require('react-native-blob-util')).default;
}

export function documentPicker(): { pick: (opts?: any) => Promise<any[]>; types: any } {
  return load<any>('@react-native-documents/picker', 'The file picker', () => require('@react-native-documents/picker'));
}

export function pdfComponent(): any | null {
  try { const m = require('react-native-pdf'); return m.default ?? m; } catch { return null; }
}

export function videoComponent(): any | null {
  try { const m = require('react-native-video'); return m.default ?? m; } catch { return null; }
}
