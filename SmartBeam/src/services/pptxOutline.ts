import JSZip from 'jszip';

/** Pure helpers: on-device text outline for PPTX / DOCX (used only when no converter is available). */

export function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

/** Returns one string per paragraph (<a:p>) found in a DrawingML part. */
export function extractParagraphs(xml: string, runTag = 'a:t', paraTag = 'a:p'): string[] {
  const paras = xml.split(new RegExp(`<${paraTag}[ >/]`)).slice(1);
  const out: string[] = [];
  const runRe = new RegExp(`<${runTag}(?: [^>]*)?>([\\s\\S]*?)</${runTag}>`, 'g');
  for (const p of paras) {
    let text = '';
    let m: RegExpExecArray | null;
    runRe.lastIndex = 0;
    while ((m = runRe.exec(p))) text += decodeXml(m[1]);
    if (text.trim()) out.push(text.trim());
  }
  return out;
}

const numericOrder = (a: string, b: string) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0);

export interface OutlineResult { slides: string[][]; notes: string[] }

export async function parsePptxOutline(base64: string): Promise<OutlineResult> {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const slideNames = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(numericOrder);
  if (!slideNames.length) throw new Error('No slides found. The file may be damaged or not a .pptx.');
  const slides: string[][] = [];
  const notes: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.file(name)!.async('string');
    slides.push(extractParagraphs(xml));
    let note = '';
    const relsFile = zip.file(name.replace('slides/', 'slides/_rels/') + '.rels');
    if (relsFile) {
      const rels = await relsFile.async('string');
      const m = /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(rels);
      const nf = m && zip.file('ppt/notesSlides/' + m[1]);
      if (nf) note = extractParagraphs(await nf.async('string')).filter((t) => !/^\d+$/.test(t)).join('\n');
    }
    notes.push(note);
  }
  return { slides, notes };
}

/** Groups DOCX paragraphs into pseudo-pages of up to `perPage` paragraphs. */
export async function parseDocxOutline(base64: string, perPage = 14): Promise<OutlineResult> {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('This does not look like a .docx file.');
  const paras = extractParagraphs(await doc.async('string'), 'w:t', 'w:p');
  const pages: string[][] = [];
  for (let i = 0; i < paras.length; i += perPage) pages.push(paras.slice(i, i + perPage));
  if (!pages.length) pages.push(['(This document has no readable text.)']);
  return { slides: pages, notes: pages.map(() => '') };
}
