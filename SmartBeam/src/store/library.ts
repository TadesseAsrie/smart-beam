import { create } from 'zustand';
import { blobUtil } from '../native/lib';
import { conversionsRepo, filesRepo, foldersRepo, historyRepo } from '../db/repositories';
import { Files } from '../native';
import type { FileRecord, Folder, HistoryRecord } from '../types';
import { detectKind, extOf, isSupported, mimeFor } from '../utils/fileTypes';
import { SmartBeamError } from '../utils/errors';
import { uid } from '../utils/format';
import { useSettings } from './settings';

export interface ImportSource { uri: string; name: string }

interface LibraryState {
  ready: boolean;
  files: FileRecord[];
  folders: Folder[];
  history: HistoryRecord[];
  load: () => Promise<void>;
  importFiles: (sources: ImportSource[], folderId?: string | null) => Promise<{ imported: FileRecord[]; skipped: string[] }>;
  toggleFavorite: (id: string) => Promise<void>;
  markOpened: (id: string) => Promise<void>;
  rename: (id: string, newName: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  moveToFolder: (id: string, folderId: string | null) => Promise<void>;
  createFolder: (name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  upsertHistory: (h: HistoryRecord) => Promise<void>;
  removeHistory: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  clearConversions: () => Promise<number>;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  ready: false,
  files: [],
  folders: [],
  history: [],

  load: async () => {
    const [files, folders, history] = await Promise.all([filesRepo.list(), foldersRepo.list(), historyRepo.list()]);
    // Drop records whose managed copy has disappeared (e.g. user cleared app storage).
    const checked: FileRecord[] = [];
    for (const f of files) {
      let present = true;
      try { present = await blobUtil().fs.exists(f.path); } catch { /* file module unavailable: keep the record */ }
      if (present) checked.push(f);
      else await filesRepo.remove(f.id);
    }
    set({ files: checked, folders, history, ready: true });
  },

  importFiles: async (sources, folderId = null) => {
    const imported: FileRecord[] = [];
    const skipped: string[] = [];
    for (const src of sources) {
      const kind = detectKind(src.name);
      if (!kind || !isSupported(src.name)) { skipped.push(src.name); continue; }
      try {
        const r = await Files.importFile(src.uri, src.name);
        const rec: FileRecord = {
          id: uid('f_'), name: r.name, ext: extOf(r.name), kind, path: r.path, mime: mimeFor(r.name), size: r.size,
          modifiedAt: r.modified || Date.now(), importedAt: Date.now(), folderId, favorite: false, lastOpenedAt: null
        };
        await filesRepo.insert(rec);
        imported.push(rec);
      } catch {
        skipped.push(src.name);
      }
    }
    if (imported.length) set((s) => ({ files: [...imported, ...s.files] }));
    return { imported, skipped };
  },

  toggleFavorite: async (id) => {
    const f = get().files.find((x) => x.id === id);
    if (!f) return;
    const favorite = !f.favorite;
    await filesRepo.update(id, { favorite });
    await historyRepo.setFavoriteForFile(id, favorite);
    set((s) => ({
      files: s.files.map((x) => (x.id === id ? { ...x, favorite } : x)),
      history: s.history.map((h) => (h.fileId === id ? { ...h, favorite } : h))
    }));
  },

  markOpened: async (id) => {
    const now = Date.now();
    await filesRepo.update(id, { lastOpenedAt: now });
    set((s) => ({ files: s.files.map((x) => (x.id === id ? { ...x, lastOpenedAt: now } : x)) }));
  },

  rename: async (id, newName) => {
    const f = get().files.find((x) => x.id === id);
    if (!f) return;
    const trimmed = newName.trim();
    if (!trimmed) throw new SmartBeamError('INVALID_NAME', 'Name cannot be empty.');
    const withExt = trimmed.toLowerCase().endsWith('.' + f.ext) ? trimmed : `${trimmed}.${f.ext}`;
    const path = await Files.renameFile(f.path, withExt);
    const name = path.split('/').pop() ?? withExt;
    await filesRepo.update(id, { name, path });
    set((s) => ({ files: s.files.map((x) => (x.id === id ? { ...x, name, path } : x)) }));
  },

  remove: async (id) => {
    const f = get().files.find((x) => x.id === id);
    if (!f) return;
    const conv = await conversionsRepo.get(id);
    await Files.deleteFile(f.path).catch(() => false);
    if (conv) await Files.deleteFile(conv.pdfPath).catch(() => false);
    await filesRepo.remove(id);
    set((s) => ({ files: s.files.filter((x) => x.id !== id) }));
  },

  moveToFolder: async (id, folderId) => {
    await filesRepo.update(id, { folderId });
    set((s) => ({ files: s.files.map((x) => (x.id === id ? { ...x, folderId } : x)) }));
  },

  createFolder: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) throw new SmartBeamError('INVALID_NAME', 'Folder name cannot be empty.');
    if (get().folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) throw new SmartBeamError('DUPLICATE', 'A folder with that name already exists.');
    const folder: Folder = { id: uid('d_'), name: trimmed, createdAt: Date.now() };
    await foldersRepo.insert(folder);
    set((s) => ({ folders: [...s.folders, folder].sort((a, b) => a.name.localeCompare(b.name)) }));
    return folder;
  },

  renameFolder: async (id, name) => {
    await foldersRepo.rename(id, name.trim());
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)) }));
  },

  deleteFolder: async (id) => {
    await filesRepo.clearFolder(id);
    await foldersRepo.remove(id);
    set((s) => ({ folders: s.folders.filter((f) => f.id !== id), files: s.files.map((x) => (x.folderId === id ? { ...x, folderId: null } : x)) }));
  },

  upsertHistory: async (h) => {
    if (!useSettings.getState().rememberHistory) return;
    await historyRepo.upsert(h);
    set((s) => ({ history: [h, ...s.history.filter((x) => x.id !== h.id)].sort((a, b) => b.presentedAt - a.presentedAt) }));
  },

  removeHistory: async (id) => {
    await historyRepo.remove(id);
    set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
  },

  clearHistory: async () => {
    await historyRepo.clear();
    set({ history: [] });
  },

  clearConversions: async () => {
    const all = await conversionsRepo.list();
    let freed = 0;
    for (const c of all) {
      try { const st = await blobUtil().fs.stat(c.pdfPath); freed += Number(st.size); } catch { /* ignore */ }
      await Files.deleteFile(c.pdfPath).catch(() => false);
    }
    await conversionsRepo.clear();
    return freed;
  }
}));
