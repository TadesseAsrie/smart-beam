import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Android 13+ gates local-network device discovery behind "Nearby devices". We ask just before discovery
 * starts (with a rationale) and continue even if it is refused so the user still gets a clear result.
 */
export async function ensureDiscoveryPermission(): Promise<'granted' | 'denied' | 'not-needed'> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return 'not-needed';
  const perm = 'android.permission.NEARBY_WIFI_DEVICES' as Parameters<typeof PermissionsAndroid.check>[0];
  if (await PermissionsAndroid.check(perm)) return 'granted';
  const r = await PermissionsAndroid.request(perm, {
    title: 'Find projectors near you',
    message: 'SmartBeam needs the "Nearby devices" permission to find Cast receivers on your Wi-Fi network. It is not used to track your location.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now'
  });
  return r === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
}
