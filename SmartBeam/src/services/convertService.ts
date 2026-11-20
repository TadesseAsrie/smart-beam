import { blobUtil } from '../native/lib';
import { conversionsRepo } from '../db/repositories';
import { useSettings } from '../store/settings';
import type { FileRecord } from '../types';
import { SmartBeamError } from '../utils/errors';
import { hasBackend, uploadToBackend } from './hosting';
import { parseDocxOutline, parsePptxOutline } from './pptxOutline';

export type ConvertStrategy = 'cache' | 'backend' | 'outline';

export interface ConvertResult {
  strategy: ConvertStrategy;
  pdfPath?: string;
  notes: string[];
  outline?: string[][];
  warnings: string[];
}

export const POWERPOINT_LIMITATIONS = [
  'Animations and slide transitions are not preserved: each slide is shown as a static page.',
  'Embedded video/audio and macros are not rendered.',
  'Fonts missing on the converter are substituted, which can shift text slightly.'
];

export const OUTLINE_LIMITATIONS = [
  'Outline view shows text only. Layouts, images, charts, animations and transitions are not rendered on the device.',
  'This view cannot be sent to a projector as slides. Connect to the SmartBeam server to convert the file to a full-fidelity PDF.'
];

/**
 * Rendering strategy for PPT/PPTX/DOC/DOCX:
 *  1. offline cache of a previous conversion  2. backend conversion to PDF (explicit consent)
 *  3. on-device text outline (PPTX/DOCX only)  - or a clear error.
 */
export async function prepareConverted(file: FileRecord, opts: { forceRefresh?: boolean } = {}): Promise<ConvertResult> {
  if (!opts.forceRefresh) {
    const cached = await conversionsRepo.get(file.id);
    if (cached && (await blobUtil().fs.exists(cached.pdfPath))) {
      return { strategy: 'cache', pdfPath: cached.pdfPath, notes: cached.notes, warnings: file.kind === 'ppt' ? POWERPOINT_LIMITATIONS : [] };
    }
  }

  let backendError: SmartBeamError | null = null;
  if (hasBackend()) {
    try {
      const hosted = await uploadToBackend({ id: file.id, name: file.name, path: file.path, mime: file.mime }, { convert: true });
      if (!hosted.pdfUrl) throw new SmartBeamError('CONVERT_FAILED', 'The server could not convert this file. It may use unsupported features or be password protected.');
      const dir = `${blobUtil().fs.dirs.DocumentDir}/converted`;
      if (!(await blobUtil().fs.isDir(dir))) await blobUtil().fs.mkdir(dir);
      const dest = `${dir}/${file.id}.pdf`;
      await blobUtil().config({ path: dest }).fetch('GET', hosted.pdfUrl, useSettings.getState().backendKey ? { 'x-smartbeam-key': useSettings.getState().backendKey } : {});
      const notes = hosted.notes ?? [];
      await conversionsRepo.put({ fileId: file.id, pdfPath: dest, notes, createdAt: Date.now() });
      return { strategy: 'backend', pdfPath: dest, notes, warnings: file.kind === 'ppt' ? POWERPOINT_LIMITATIONS : [] };
    } catch (e) {
      if (e instanceof SmartBeamError && e.code === 'USER_CANCELLED') throw e;
      backendError = e instanceof SmartBeamError ? e : new SmartBeamError('CONVERT_FAILED', 'Conversion failed.');
    }
  }

  // On-device fallback
  if (file.ext === 'pptx' || file.ext === 'docx') {
    try {
      const b64 = await blobUtil().fs.readFile(file.path, 'base64');
      const r = file.ext === 'pptx' ? await parsePptxOutline(b64) : await parseDocxOutline(b64);
      const warnings = [...OUTLINE_LIMITATIONS];
      if (backendError) warnings.unshift(`Server conversion unavailable: ${backendError.message}`);
      return { strategy: 'outline', notes: r.notes, outline: r.slides, warnings };
    } catch (e) {
      throw new SmartBeamError('UNSUPPORTED_FILE', `This file could not be read: ${(e as Error).message}`);
    }
  }

  throw new SmartBeamError(
    'UNSUPPORTED_FILE',
    backendError
      ? `Legacy .${file.ext} files need the SmartBeam server for conversion, and it failed: ${backendError.message}`
      : `Legacy .${file.ext} files can only be displayed after conversion. Set up the SmartBeam server in Settings, or save the file as .${file.ext === 'ppt' ? 'pptx' : 'docx'} or PDF.`
  );
}
