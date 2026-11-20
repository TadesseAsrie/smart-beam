import { clamp, formatBytes, formatDuration, formatRelative } from '../src/utils/format';
import { detectKind, extOf, isSupported, mimeFor } from '../src/utils/fileTypes';

describe('format', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(-4)).toBe('0:00');
  });
  it('formats relative time', () => {
    const now = 1_000_000_000;
    expect(formatRelative(now - 30_000, now)).toBe('Just now');
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatRelative(now - 3 * 3600_000, now)).toBe('3 h ago');
  });
  it('clamps', () => expect(clamp(9, 1, 5)).toBe(5));
});

describe('fileTypes', () => {
  it('detects every supported type', () => {
    const cases: [string, string][] = [['a.PDF', 'pdf'], ['a.ppt', 'ppt'], ['a.pptx', 'ppt'], ['a.doc', 'doc'], ['a.docx', 'doc'], ['a.jpg', 'image'], ['a.jpeg', 'image'], ['a.png', 'image'], ['a.mp4', 'video'], ['a.mov', 'video']];
    for (const [n, k] of cases) expect(detectKind(n)).toBe(k);
  });
  it('rejects unsupported files', () => { expect(isSupported('virus.exe')).toBe(false); expect(detectKind('noext')).toBeNull(); });
  it('maps mime types and extensions', () => { expect(mimeFor('x.pdf')).toBe('application/pdf'); expect(extOf('a.b.docx')).toBe('docx'); });
});
