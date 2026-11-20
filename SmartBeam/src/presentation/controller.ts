import { connectionManager } from '../connection';
import { PdfNative } from '../native';
import { cleanupHosted } from '../services/hosting';
import { prepareConverted } from '../services/convertService';
import { useConnection } from '../store/connection';
import { useLibrary } from '../store/library';
import { elapsedSeconds, usePresentation, type PresentationKind } from '../store/presentation';
import { useSettings } from '../store/settings';
import type { FileRecord, HistoryRecord, PresentContent, RemoteCommand } from '../types';
import { SmartBeamError, reportError, userMessage } from '../utils/errors';
import { clamp, uid } from '../utils/format';

interface Prepared { kind: PresentationKind; path: string | null; total: number; notes: string[]; outline?: string[][]; warnings: string[] }

let startedAtMs = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let initialised = false;

const store = () => usePresentation.getState();

async function prepare(file: FileRecord): Promise<Prepared> {
  switch (file.kind) {
    case 'pdf':
      return { kind: 'pdf', path: file.path, total: await PdfNative.pageCount(file.path), notes: [], warnings: [] };
    case 'ppt':
    case 'doc': {
      const r = await prepareConverted(file);
      if (r.pdfPath) return { kind: 'pdf', path: r.pdfPath, total: await PdfNative.pageCount(r.pdfPath), notes: r.notes, warnings: r.warnings };
      return { kind: 'outline', path: null, total: r.outline?.length ?? 1, notes: r.notes, outline: r.outline, warnings: r.warnings };
    }
    case 'image':
      return { kind: 'image', path: file.path, total: 1, notes: [], warnings: [] };
    case 'video':
      return { kind: 'video', path: file.path, total: 1, notes: [], warnings: [] };
  }
}

function contentFor(): PresentContent | null {
  const s = store();
  if (!s.file || !s.path || !s.kind || s.kind === 'outline') return null;
  return {
    kind: s.kind, path: s.path, mime: s.kind === 'pdf' ? 'application/pdf' : s.file.mime, title: s.file.name,
    fileId: s.file.id, page: s.page, totalPages: s.total
  };
}

async function pushToOutput(): Promise<void> {
  const adapter = connectionManager.current();
  const s = store();
  if (!adapter) {
    const guided = useConnection.getState().status === 'guidance';
    s.patch({ outputMode: guided ? 'mirror' : 'local', outputError: null });
    return;
  }
  const content = contentFor();
  if (!content) {
    s.patch({ outputMode: 'local', outputError: 'Outline view cannot be sent to the projector. Convert the file with the SmartBeam server for full slides.' });
    return;
  }
  try {
    await adapter.present(content);
    store().patch({ outputMode: 'external', outputError: null });
  } catch (e) {
    store().patch({ outputMode: 'local', outputError: userMessage(e) });
    reportError(e, { context: 'present' });
  }
}

function dispatch(cmd: RemoteCommand): void {
  const adapter = connectionManager.current();
  if (!adapter || store().outputMode !== 'external') return;
  adapter.send(cmd).catch((e) => { store().patch({ outputError: userMessage(e) }); reportError(e, { context: 'command' }); });
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveProgress().catch(() => undefined); }, 800);
}

export async function saveProgress(): Promise<void> {
  const s = store();
  if (!s.file || !s.sessionId) return;
  const rec: HistoryRecord = {
    id: s.sessionId, fileId: s.file.id, fileName: s.file.name, fileKind: s.file.kind, presentedAt: startedAtMs || Date.now(),
    lastSlide: s.page, totalSlides: s.total, durationSec: Math.round(elapsedSeconds(s)), favorite: s.file.favorite
  };
  await useLibrary.getState().upsertHistory(rec);
}

/** Wire adapter callbacks once (called from App). */
export function initPresentationController(): void {
  if (initialised) return;
  initialised = true;
  connectionManager.onRemoteState((r) => {
    const s = store();
    if (s.status !== 'live') return;
    if (r.page && r.page !== s.page && s.kind === 'pdf') s.patch({ page: clamp(r.page, 1, s.total) });
    if (r.video) s.patch({ video: r.video });
    if (r.error) s.patch({ outputError: r.error });
  });
  connectionManager.onLost((reason) => {
    const s = store();
    if (s.status === 'live') s.patch({ outputMode: 'local', outputError: `Display disconnected: ${reason}` });
  });
}

export async function openPresentation(file: FileRecord, opts: { startPage?: number; playlist?: string[] } = {}): Promise<void> {
  if (store().status === 'live') await exitPresentation();
  store().reset();
  const sessionId = uid('s_');
  startedAtMs = Date.now();
  store().patch({ status: 'preparing', file, sessionId, playlist: opts.playlist ?? [] });
  try {
    const p = await prepare(file);
    store().patch({
      status: 'live', kind: p.kind, path: p.path, total: Math.max(1, p.total), page: clamp(opts.startPage ?? 1, 1, Math.max(1, p.total)),
      notes: p.notes, outline: p.outline ?? [], warnings: p.warnings, elapsedBase: 0, resumedAt: Date.now()
    });
    useLibrary.getState().markOpened(file.id).catch(() => undefined);
    await pushToOutput();
    await saveProgress();
  } catch (e) {
    store().reset();
    throw e;
  }
}

export async function resumeFromHistory(h: HistoryRecord): Promise<void> {
  const file = useLibrary.getState().files.find((f) => f.id === h.fileId);
  if (!file) throw new SmartBeamError('FILE_MISSING', 'This file is no longer in your library, so the presentation cannot be resumed.');
  await openPresentation(file, { startPage: h.lastSlide });
}

export function goTo(page: number): void {
  const s = store();
  if (s.status !== 'live' || s.paused || (s.kind !== 'pdf' && s.kind !== 'outline')) return;
  const p = clamp(Math.round(page), 1, s.total);
  if (p === s.page) return;
  s.patch({ page: p });
  dispatch({ type: 'goto', page: p });
  scheduleSave();
}
export const nextSlide = () => goTo(store().page + 1);
export const prevSlide = () => goTo(store().page - 1);

export function pause(): void {
  const s = store();
  if (s.status !== 'live' || s.paused) return;
  s.patch({ paused: true, elapsedBase: elapsedSeconds(s), resumedAt: null });
  dispatch({ type: 'pause' });
}

export function resume(): void {
  const s = store();
  if (s.status !== 'live' || !s.paused) return;
  s.patch({ paused: false, resumedAt: Date.now() });
  dispatch({ type: 'resume' });
}

export function setBlackout(on: boolean): void {
  if (store().status !== 'live') return;
  store().patch({ blackout: on });
  dispatch({ type: 'blackout', on });
}

export function setPointer(x: number, y: number, visible: boolean): void {
  if (store().status !== 'live') return;
  const p = { x: clamp(x, 0, 1), y: clamp(y, 0, 1), visible };
  store().patch({ pointer: p });
  dispatch({ type: 'pointer', ...p });
}

export function videoCommand(action: 'play' | 'pause' | 'seek' | 'stop' | 'volume', value?: number): void {
  dispatch({ type: 'video', action, value });
}

export async function exitPresentation(): Promise<void> {
  const s = store();
  if (s.status === 'idle') return;
  const file = s.file;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const adapter = connectionManager.current();
  if (adapter && s.outputMode === 'external') await adapter.send({ type: 'exit' }).catch(() => undefined);
  if (s.status === 'live') await saveProgress().catch(() => undefined);
  await cleanupHosted();
  store().reset();
  if (file && useSettings.getState().autoDeleteImportedAfterPresenting) {
    await useLibrary.getState().remove(file.id).catch(() => undefined);
  }
}

/** Retry sending the current content to the connected display after an error. */
export async function retryOutput(): Promise<void> {
  if (store().status === 'live') await pushToOutput();
}
