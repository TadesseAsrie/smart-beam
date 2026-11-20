import { documentPicker } from '../native/lib';
import { Files, type TreeEntry } from '../native';
import { SUPPORTED_EXTENSIONS, isSupported } from '../utils/fileTypes';
import type { ImportSource } from '../store/library';

/** Opens the Android system picker (Storage Access Framework) — no storage permission needed. */
export async function pickDocuments(): Promise<ImportSource[]> {
  const { pick, types } = documentPicker();
  // allFiles: some providers misreport MIME types, so filter by extension afterwards (isSupported).
  const res = await pick({ allowMultiSelection: true, type: [types.allFiles] });
  return res.filter((r: any) => r.name && isSupported(r.name)).map((r: any) => ({ uri: r.uri as string, name: r.name as string }));
}

export async function pickSubtitle(): Promise<{ uri: string; name: string; type: 'text/vtt' | 'application/x-subrip' } | null> {
  const { pick, types } = documentPicker();
  const [r] = await pick({ type: [types.allFiles] });
  if (!r) return null;
  const n = (r.name ?? '').toLowerCase();
  if (n.endsWith('.vtt')) return { uri: r.uri, name: r.name!, type: 'text/vtt' };
  if (n.endsWith('.srt')) return { uri: r.uri, name: r.name!, type: 'application/x-subrip' };
  return null;
}

export async function listFolder(treeUri: string): Promise<TreeEntry[]> {
  const entries = await Files.listTree(treeUri);
  return entries
    .filter((e) => e.isDir || isSupported(e.name))
    .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
}

export { SUPPORTED_EXTENSIONS };
