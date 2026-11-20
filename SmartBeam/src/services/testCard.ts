import { Asset } from 'expo-asset';

/** Returns a local file path of the bundled test card (used by the Connection Assistant's output test). */
export async function getTestCardPath(): Promise<string> {
  const asset = Asset.fromModule(require('../../assets/test-card.png'));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return uri.replace(/^file:\/\//, '');
}
