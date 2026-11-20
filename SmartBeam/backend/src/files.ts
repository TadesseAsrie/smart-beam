import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import JSZip from 'jszip';

export const ALLOWED = new Set(['pdf', 'ppt', 'pptx', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'mp4', 'mov']);
export const CONVERTIBLE = new Set(['ppt', 'pptx', 'doc', 'docx']);
export const MIME: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', mov: 'video/quicktime'
};

export const extOf = (n: string) => (n.includes('.') ? n.split('.').pop()!.toLowerCase() : '');

export function safeName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
  return base || 'file';
}

export function kindOf(ext: string): 'pdf' | 'image' | 'video' | 'office' {
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  if (['mp4', 'mov'].includes(ext)) return 'video';
  return 'office';
}

/** Verifies the file's magic bytes so a renamed executable cannot pass as a document. */
export function looksLikeExpectedType(file: string, ext: string): boolean {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const hex = buf.toString('hex');
  switch (ext) {
    case 'pdf': return buf.toString('latin1', 0, 5) === '%PDF-';
    case 'pptx': case 'docx': return hex.startsWith('504b0304');
    case 'ppt': case 'doc': return hex.startsWith('d0cf11e0');
    case 'jpg': case 'jpeg': return hex.startsWith('ffd8ff');
    case 'png': return hex.startsWith('89504e47');
    case 'mp4': case 'mov': return buf.toString('latin1', 4, 8) === 'ftyp' || buf.toString('latin1', 4, 8) === 'moov' || buf.toString('latin1', 4, 8) === 'wide' || buf.toString('latin1', 4, 8) === 'mdat';
    default: return false;
  }
}

export function convertToPdf(soffice: string, input: string, outDir: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const profile = path.join(outDir, '.lo-profile');
    const child = spawn(soffice, [`-env:UserInstallation=file://${profile}`, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', outDir, input], { stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Conversion timed out')); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); reject(new Error('Converter is not available: ' + e.message)); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      const out = path.join(outDir, path.basename(input).replace(/\.[^.]+$/, '') + '.pdf');
      fs.rmSync(profile, { recursive: true, force: true });
      if (code === 0 && fs.existsSync(out)) resolve(out); else reject(new Error('The document could not be converted'));
    });
  });
}

function decode(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Extracts speaker notes (one entry per slide, in slide order) from a .pptx. */
export async function extractNotes(file: string): Promise<string[]> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const num = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;
  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  const notes: string[] = [];
  for (const s of slides) {
    let text = '';
    const rels = zip.file(s.replace('slides/', 'slides/_rels/') + '.rels');
    if (rels) {
      const m = /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(await rels.async('string'));
      const nf = m && zip.file('ppt/notesSlides/' + m[1]);
      if (nf) {
        const xml = await nf.async('string');
        text = xml.split(/<a:p[ >\/]/).slice(1).map((p) => [...p.matchAll(/<a:t(?: [^>]*)?>([\s\S]*?)<\/a:t>/g)].map((x) => decode(x[1])).join('')).filter((t) => t.trim() && !/^\d+$/.test(t.trim())).join('\n');
      }
    }
    notes.push(text);
  }
  return notes;
}
