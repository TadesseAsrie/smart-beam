import type { FileKind } from '../types';

const MAP: Record<string, { kind: FileKind; mime: string }> = {
  pdf: { kind: 'pdf', mime: 'application/pdf' },
  ppt: { kind: 'ppt', mime: 'application/vnd.ms-powerpoint' },
  pptx: { kind: 'ppt', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  doc: { kind: 'doc', mime: 'application/msword' },
  docx: { kind: 'doc', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  png: { kind: 'image', mime: 'image/png' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  mov: { kind: 'video', mime: 'video/quicktime' }
};

export const SUPPORTED_EXTENSIONS = Object.keys(MAP);

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function isSupported(name: string): boolean {
  return extOf(name) in MAP;
}

export function detectKind(name: string): FileKind | null {
  return MAP[extOf(name)]?.kind ?? null;
}

export function mimeFor(name: string): string {
  return MAP[extOf(name)]?.mime ?? 'application/octet-stream';
}

export const KIND_LABEL: Record<FileKind, string> = { pdf: 'PDF', ppt: 'Presentation', doc: 'Document', image: 'Image', video: 'Video' };
