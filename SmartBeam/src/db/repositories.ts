import { getDb } from './database';
import type { FileRecord, Folder, HistoryRecord, FileKind } from '../types';

type FileRow = { id: string; name: string; ext: string; kind: FileKind; path: string; mime: string; size: number; modified_at: number; imported_at: number; folder_id: string | null; favorite: number; last_opened_at: number | null };
type HistRow = { id: string; file_id: string; file_name: string; file_kind: FileKind; presented_at: number; last_slide: number; total_slides: number; duration_sec: number; favorite: number };

const toFile = (r: FileRow): FileRecord => ({
  id: r.id, name: r.name, ext: r.ext, kind: r.kind, path: r.path, mime: r.mime, size: r.size,
  modifiedAt: r.modified_at, importedAt: r.imported_at, folderId: r.folder_id, favorite: !!r.favorite, lastOpenedAt: r.last_opened_at
});
const toHist = (r: HistRow): HistoryRecord => ({
  id: r.id, fileId: r.file_id, fileName: r.file_name, fileKind: r.file_kind, presentedAt: r.presented_at,
  lastSlide: r.last_slide, totalSlides: r.total_slides, durationSec: r.duration_sec, favorite: !!r.favorite
});

export const filesRepo = {
  async list(): Promise<FileRecord[]> {
    const db = await getDb();
    return (await db.getAllAsync<FileRow>('SELECT * FROM files ORDER BY imported_at DESC')).map(toFile);
  },
  async get(id: string): Promise<FileRecord | null> {
    const db = await getDb();
    const r = await db.getFirstAsync<FileRow>('SELECT * FROM files WHERE id = ?', [id]);
    return r ? toFile(r) : null;
  },
  async insert(f: FileRecord): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO files (id,name,ext,kind,path,mime,size,modified_at,imported_at,folder_id,favorite,last_opened_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [f.id, f.name, f.ext, f.kind, f.path, f.mime, f.size, f.modifiedAt, f.importedAt, f.folderId, f.favorite ? 1 : 0, f.lastOpenedAt]
    );
  },
  async update(id: string, patch: Partial<Pick<FileRecord, 'name' | 'path' | 'folderId' | 'favorite' | 'lastOpenedAt'>>): Promise<void> {
    const db = await getDb();
    const sets: string[] = []; const vals: (string | number | null)[] = [];
    if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
    if (patch.path !== undefined) { sets.push('path = ?'); vals.push(patch.path); }
    if (patch.folderId !== undefined) { sets.push('folder_id = ?'); vals.push(patch.folderId); }
    if (patch.favorite !== undefined) { sets.push('favorite = ?'); vals.push(patch.favorite ? 1 : 0); }
    if (patch.lastOpenedAt !== undefined) { sets.push('last_opened_at = ?'); vals.push(patch.lastOpenedAt); }
    if (!sets.length) return;
    await db.runAsync(`UPDATE files SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM files WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM conversions WHERE file_id = ?', [id]);
  },
  async clearFolder(folderId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE files SET folder_id = NULL WHERE folder_id = ?', [folderId]);
  }
};

export const foldersRepo = {
  async list(): Promise<Folder[]> {
    const db = await getDb();
    return (await db.getAllAsync<{ id: string; name: string; created_at: number }>('SELECT * FROM folders ORDER BY name COLLATE NOCASE')).map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
  },
  async insert(f: Folder): Promise<void> {
    const db = await getDb();
    await db.runAsync('INSERT INTO folders (id,name,created_at) VALUES (?,?,?)', [f.id, f.name, f.createdAt]);
  },
  async rename(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE folders SET name = ? WHERE id = ?', [name, id]);
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM folders WHERE id = ?', [id]);
  }
};

export const historyRepo = {
  async list(): Promise<HistoryRecord[]> {
    const db = await getDb();
    return (await db.getAllAsync<HistRow>('SELECT * FROM history ORDER BY presented_at DESC LIMIT 200')).map(toHist);
  },
  async upsert(h: HistoryRecord): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO history (id,file_id,file_name,file_kind,presented_at,last_slide,total_slides,duration_sec,favorite) VALUES (?,?,?,?,?,?,?,?,?)',
      [h.id, h.fileId, h.fileName, h.fileKind, h.presentedAt, h.lastSlide, h.totalSlides, h.durationSec, h.favorite ? 1 : 0]
    );
  },
  async setFavoriteForFile(fileId: string, favorite: boolean): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE history SET favorite = ? WHERE file_id = ?', [favorite ? 1 : 0, fileId]);
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM history WHERE id = ?', [id]);
  },
  async clear(): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM history');
  }
};

export interface ConversionRecord { fileId: string; pdfPath: string; notes: string[]; createdAt: number }

export const conversionsRepo = {
  async get(fileId: string): Promise<ConversionRecord | null> {
    const db = await getDb();
    const r = await db.getFirstAsync<{ file_id: string; pdf_path: string; notes_json: string; created_at: number }>('SELECT * FROM conversions WHERE file_id = ?', [fileId]);
    if (!r) return null;
    let notes: string[] = [];
    try { notes = JSON.parse(r.notes_json); } catch { /* ignore */ }
    return { fileId: r.file_id, pdfPath: r.pdf_path, notes, createdAt: r.created_at };
  },
  async put(c: ConversionRecord): Promise<void> {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO conversions (file_id,pdf_path,notes_json,created_at) VALUES (?,?,?,?)', [c.fileId, c.pdfPath, JSON.stringify(c.notes), c.createdAt]);
  },
  async list(): Promise<ConversionRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ file_id: string; pdf_path: string; notes_json: string; created_at: number }>('SELECT * FROM conversions');
    return rows.map((r) => ({ fileId: r.file_id, pdfPath: r.pdf_path, notes: JSON.parse(r.notes_json || '[]'), createdAt: r.created_at }));
  },
  async clear(): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM conversions');
  }
};
