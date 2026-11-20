import JSZip from 'jszip';
import { decodeXml, extractParagraphs, parseDocxOutline, parsePptxOutline } from '../src/services/pptxOutline';

const slide = (lines: string[]) => `<p:sld>${lines.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join('')}</p:sld>`;

describe('pptx outline', () => {
  it('decodes xml entities', () => expect(decodeXml('Tom &amp; Jerry &lt;3 &#65;')).toBe('Tom & Jerry <3 A'));
  it('extracts paragraphs', () => expect(extractParagraphs(slide(['Hello', 'World']))).toEqual(['Hello', 'World']));

  it('reads slides in numeric order with notes', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide2.xml', slide(['Second']));
    zip.file('ppt/slides/slide10.xml', slide(['Tenth']));
    zip.file('ppt/slides/slide1.xml', slide(['First']));
    zip.file('ppt/slides/_rels/slide1.xml.rels', '<Relationships><Relationship Target="../notesSlides/notesSlide1.xml"/></Relationships>');
    zip.file('ppt/notesSlides/notesSlide1.xml', slide(['Remember to smile', '1']));
    const b64 = await zip.generateAsync({ type: 'base64' });
    const r = await parsePptxOutline(b64);
    expect(r.slides.map((s) => s[0])).toEqual(['First', 'Second', 'Tenth']);
    expect(r.notes[0]).toBe('Remember to smile');
    expect(r.notes[1]).toBe('');
  });

  it('fails clearly on a file without slides', async () => {
    const zip = new JSZip(); zip.file('readme.txt', 'x');
    await expect(parsePptxOutline(await zip.generateAsync({ type: 'base64' }))).rejects.toThrow(/No slides/);
  });

  it('pages docx text', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', `<w:document>${Array.from({ length: 30 }, (_, i) => `<w:p><w:r><w:t>Line ${i}</w:t></w:r></w:p>`).join('')}</w:document>`);
    const r = await parseDocxOutline(await zip.generateAsync({ type: 'base64' }), 14);
    expect(r.slides.length).toBe(3);
    expect(r.slides[0][0]).toBe('Line 0');
  });
});
