import { Alert } from 'react-native';

const granted = new Set<string>();

/**
 * Explicit, per-file consent before ANY document leaves the device. The grant is kept in memory only
 * (so it is forgotten when the app closes) and is scoped to a single file + server host.
 */
export function requestUploadConsent(fileName: string, host: string, fileId: string): Promise<boolean> {
  const key = `${fileId}@${host}`;
  if (granted.has(key)) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      'Upload this file?',
      `"${fileName}" will be sent to ${host} so the projector can display it. The temporary copy is deleted when you finish presenting, and automatically expires after a short time.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Upload', onPress: () => { granted.add(key); resolve(true); } }
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export function forgetConsents(): void { granted.clear(); }
