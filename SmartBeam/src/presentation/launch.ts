import { Alert } from 'react-native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { connectionManager } from '../connection';
import { useConnection } from '../store/connection';
import { usePresentation } from '../store/presentation';
import type { Device, FileRecord, HistoryRecord } from '../types';
import { SmartBeamError, isCancel, reportError } from '../utils/errors';
import { openPresentation, resumeFromHistory } from './controller';

type Nav = NavigationProp<ParamListBase>;

export function openFile(file: FileRecord, nav: Nav, startPage?: number): void {
  if (file.kind === 'video') nav.navigate('VideoPlayer', { fileId: file.id });
  else if (file.kind === 'ppt' || file.kind === 'doc') nav.navigate('PptViewer', { fileId: file.id, startPage });
  else nav.navigate('PdfViewer', { fileId: file.id, startPage });
}

function routeAfterStart(file: FileRecord, nav: Nav): void {
  const { outputMode, page } = usePresentation.getState();
  if (outputMode === 'external') { nav.navigate('PresentationController'); return; }
  if (file.kind === 'video') nav.navigate('VideoPlayer', { fileId: file.id, presenting: true });
  else if (file.kind === 'ppt' || file.kind === 'doc') nav.navigate('PptViewer', { fileId: file.id, startPage: page, presenting: true });
  else nav.navigate('PdfViewer', { fileId: file.id, startPage: page, presenting: true });
}

async function start(run: () => Promise<void>, file: FileRecord, nav: Nav): Promise<void> {
  try {
    await run();
    routeAfterStart(file, nav);
  } catch (e) {
    if (e instanceof SmartBeamError && e.code === 'USER_CANCELLED') return;
    reportError(e, { context: 'start' });
  }
}

/** Starts a presentation. If nothing is connected the user is told, never silently "connected". */
export function beginPresenting(file: FileRecord, nav: Nav, opts: { startPage?: number } = {}): void {
  const { active, status } = useConnection.getState();
  const go = () => { start(() => openPresentation(file, opts), file, nav); };
  if (active || status === 'guidance') { go(); return; }
  Alert.alert(
    'No projector connected',
    'You can connect a projector first, or present full-screen on this phone (useful with system screen mirroring).',
    [
      { text: 'Connect projector', onPress: () => nav.navigate('Tabs', { screen: 'Connect' }) },
      { text: 'Present on phone', onPress: go },
      { text: 'Cancel', style: 'cancel' }
    ]
  );
}

export function resumePresenting(h: HistoryRecord, files: FileRecord[], nav: Nav): void {
  const file = files.find((f) => f.id === h.fileId);
  if (!file) { reportError(new SmartBeamError('FILE_MISSING', 'This file is no longer in your library.')); return; }
  const { active, status } = useConnection.getState();
  const go = () => { start(() => resumeFromHistory(h), file, nav); };
  if (active || status === 'guidance') go();
  else Alert.alert('Resume presentation', 'No projector is connected. Resume on this phone?', [{ text: 'Resume', onPress: go }, { text: 'Cancel', style: 'cancel' }]);
}

/** Connects to a device and reports the true outcome. Returns true only when really connected. */
export async function connectDevice(device: Device): Promise<boolean> {
  try {
    await connectionManager.connect(device);
    return true;
  } catch (e) {
    if (e instanceof SmartBeamError && e.code === 'GUIDANCE_ONLY') { reportError(e, { context: 'guidance' }); return false; }
    if (!isCancel(e)) reportError(e, { context: 'connect' });
    return false;
  }
}
