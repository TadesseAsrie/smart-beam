import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colorScheme } from 'nativewind';
import { useSettings } from '../store/settings';

export async function applyOrientation(pref: 'auto' | 'portrait' | 'landscape'): Promise<void> {
  try {
    if (pref === 'portrait') await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    else if (pref === 'landscape') await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    else await ScreenOrientation.unlockAsync();
  } catch { /* orientation lock is best effort */ }
}

/** Applies theme + default orientation whenever the settings change. */
export function useApplyPreferences(): void {
  const theme = useSettings((s) => s.theme);
  const orientation = useSettings((s) => s.orientation);
  useEffect(() => { colorScheme.set(theme); }, [theme]);
  useEffect(() => { applyOrientation(orientation); }, [orientation]);
}
