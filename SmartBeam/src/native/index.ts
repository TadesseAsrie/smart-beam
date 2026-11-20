import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { SmartBeamError } from '../utils/errors';
import type { VideoState } from '../types';

const N = NativeModules as Record<string, any>;

/** True only in a development/release build that contains the Kotlin modules (never in Expo Go). */
export const nativeAvailable = Platform.OS === 'android' && !!N.SmartBeamCast;

function mod<T = any>(name: string): T {
  const m = N[name];
  if (!m) throw new SmartBeamError('NATIVE_UNAVAILABLE', 'This feature needs the SmartBeam native build (Android development build). Expo Go is not supported.');
  return m as T;
}

function on<T>(event: string, cb: (payload: T) => void): () => void {
  const sub = DeviceEventEmitter.addListener(event, cb);
  return () => sub.remove();
}

export interface CastRoute { id: string; name: string; description?: string; model?: string; connectionState: number }
export interface CastSessionEvent { state: 'connecting' | 'connected' | 'disconnected' | 'suspended' | 'error'; message?: string; deviceName?: string }
export interface CastConfig { appId: string; isDefaultReceiver: boolean; playServices: boolean }

export const Cast = {
  getConfig: (): Promise<CastConfig> => mod('SmartBeamCast').getConfig(),
  startDiscovery: (): Promise<boolean> => mod('SmartBeamCast').startDiscovery(),
  stopDiscovery: (): Promise<boolean> => mod('SmartBeamCast').stopDiscovery(),
  connect: (routeId: string): Promise<boolean> => mod('SmartBeamCast').connect(routeId),
  disconnect: (): Promise<boolean> => mod('SmartBeamCast').disconnect(),
  sendMessage: (json: string): Promise<boolean> => mod('SmartBeamCast').sendMessage(json),
  loadMedia: (url: string, mime: string, title: string, positionMs = 0): Promise<boolean> => mod('SmartBeamCast').loadMedia(url, mime, title, positionMs),
  mediaControl: (action: string, value = 0): Promise<boolean> => mod('SmartBeamCast').mediaControl(action, value),
  onDevices: (cb: (r: CastRoute[]) => void) => on('SmartBeamCastDevices', cb),
  onSession: (cb: (e: CastSessionEvent) => void) => on('SmartBeamCastSession', cb),
  onMessage: (cb: (json: string) => void) => on('SmartBeamCastMessage', cb),
  onMedia: (cb: (s: VideoState) => void) => on('SmartBeamCastMedia', cb)
};

export interface NativeDisplay { id: number; name: string; width: number; height: number; presentation: boolean; isDefault: boolean }

export const Display = {
  getDisplays: (): Promise<NativeDisplay[]> => mod('SmartBeamDisplay').getDisplays(),
  getAllDisplays: (): Promise<NativeDisplay[]> => mod('SmartBeamDisplay').getAllDisplays(),
  show: (id: number): Promise<boolean> => mod('SmartBeamDisplay').show(id),
  showPdf: (path: string, index0: number): Promise<boolean> => mod('SmartBeamDisplay').showPdf(path, index0),
  showImage: (path: string): Promise<boolean> => mod('SmartBeamDisplay').showImage(path),
  playVideo: (path: string): Promise<boolean> => mod('SmartBeamDisplay').playVideo(path),
  videoControl: (action: string, value = 0): Promise<boolean> => mod('SmartBeamDisplay').videoControl(action, value),
  setBlackout: (on: boolean): Promise<boolean> => mod('SmartBeamDisplay').setBlackout(on),
  setPaused: (on: boolean): Promise<boolean> => mod('SmartBeamDisplay').setPaused(on),
  setPointer: (x: number, y: number, visible: boolean): Promise<boolean> => mod('SmartBeamDisplay').setPointer(x, y, visible),
  clear: (): Promise<boolean> => mod('SmartBeamDisplay').clear(),
  dismiss: (): Promise<boolean> => mod('SmartBeamDisplay').dismiss(),
  onDisplays: (cb: (d: NativeDisplay[]) => void) => on('SmartBeamDisplays', cb),
  onLost: (cb: (id: number) => void) => on('SmartBeamDisplayLost', cb),
  onVideo: (cb: (s: VideoState) => void) => on('SmartBeamDisplayVideo', cb)
};

export const LanServer = {
  start: (): Promise<{ ip: string; port: number }> => mod('SmartBeamServer').start(),
  registerFile: (path: string, mime: string): Promise<string> => mod('SmartBeamServer').registerFile(path, mime),
  stop: (): Promise<boolean> => mod('SmartBeamServer').stop()
};

export const PdfNative = {
  pageCount: (path: string): Promise<number> => mod('SmartBeamPdf').pageCount(path),
  renderThumbnail: (path: string, index0: number, width: number): Promise<string> => mod('SmartBeamPdf').renderThumbnail(path, index0, width)
};

export interface TreeEntry { uri: string; name: string; isDir: boolean; size: number; mime: string | null; modified: number }
export interface ImportedFile { path: string; name: string; size: number; mime: string | null; modified: number }

export const Files = {
  pickTree: (): Promise<{ uri: string; name: string }> => mod('SmartBeamFiles').pickTree(),
  persistedTrees: (): Promise<{ uri: string; name: string }[]> => mod('SmartBeamFiles').persistedTrees(),
  releaseTree: (uri: string): Promise<boolean> => mod('SmartBeamFiles').releaseTree(uri),
  listTree: (uri: string): Promise<TreeEntry[]> => mod('SmartBeamFiles').listTree(uri),
  getInfo: (uri: string): Promise<{ name: string; size: number; mime: string | null; modified: number }> => mod('SmartBeamFiles').getInfo(uri),
  importFile: (uri: string, name: string): Promise<ImportedFile> => mod('SmartBeamFiles').importFile(uri, name),
  deleteFile: (path: string): Promise<boolean> => mod('SmartBeamFiles').deleteFile(path),
  renameFile: (path: string, newName: string): Promise<string> => mod('SmartBeamFiles').renameFile(path, newName),
  clearThumbnails: (): Promise<number> => mod('SmartBeamFiles').clearThumbnails()
};

export interface WirelessInfo { sdk: number; manufacturer: string; model: string; castSettingsAvailable: boolean; wifiDirect: boolean; externalDisplays: number }

export const System = {
  getWirelessDisplayInfo: (): Promise<WirelessInfo> => mod('SmartBeamSystem').getWirelessDisplayInfo(),
  openWirelessSettings: (): Promise<string> => mod('SmartBeamSystem').openWirelessSettings(),
  getNetworkState: (): Promise<{ transport: 'wifi' | 'ethernet' | 'cellular' | 'none' | 'other'; lan: boolean }> => mod('SmartBeamSystem').getNetworkState(),
  getStorageInfo: (): Promise<{ total: number; free: number; appUsed: number }> => mod('SmartBeamSystem').getStorageInfo()
};
