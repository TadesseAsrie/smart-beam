import { CloudRoomAdapter } from './CloudRoomAdapter';
import { connectionManager } from './ConnectionManager';
import { ExternalDisplayAdapter } from './ExternalDisplayAdapter';
import { GoogleCastAdapter } from './GoogleCastAdapter';
import { MiracastAdapter } from './MiracastAdapter';

let registered = false;

/**
 * Register adapters once. To add a manufacturer SDK later, implement ConnectionAdapter and add one line here —
 * nothing else in the app changes.
 */
export function registerAdapters(): void {
  if (registered) return;
  registered = true;
  connectionManager.register(new GoogleCastAdapter());
  connectionManager.register(new ExternalDisplayAdapter());
  connectionManager.register(new CloudRoomAdapter());
  connectionManager.register(new MiracastAdapter());
}

export { connectionManager };
export * from './types';
