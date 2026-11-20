import React from 'react';
import { ScrollView, View } from 'react-native';
import { pdfComponent } from '../native/lib';
import { T } from './ui';

export interface PdfPaneProps {
  path: string;
  page: number;
  scale: number;
  fit: 'both' | 'width';
  onPage: (page: number, total: number) => void;
  onLoaded: (total: number) => void;
  onError: (message: string) => void;
  onScale?: (scale: number) => void;
  background?: string;
}

/** Thin wrapper around react-native-pdf configured for slide-like paging. */
export function PdfPane({ path, page, scale, fit, onPage, onLoaded, onError, onScale, background = '#0B1220' }: PdfPaneProps) {
  const Pdf = pdfComponent();
  if (!Pdf) return <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: background }}><T muted>PDF viewer is not available in this build. Rebuild the app.</T></View>;
  return (
    <Pdf
      source={{ uri: path.startsWith('file://') ? path : 'file://' + path, cache: false }}
      page={page}
      scale={scale}
      minScale={1}
      maxScale={4}
      fitPolicy={fit === 'both' ? 2 : 0}
      enablePaging
      horizontal
      spacing={0}
      enableAntialiasing
      onPageChanged={(p, total) => onPage(p, total)}
      onLoadComplete={(total) => onLoaded(total)}
      onScaleChanged={(s) => onScale?.(s)}
      onError={(e) => onError(typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'This PDF could not be displayed.')}
      renderActivityIndicator={() => <T muted>Rendering…</T>}
      style={{ flex: 1, backgroundColor: background }}
    />
  );
}

/** Text-only view used when a presentation could only be read on the device (no converter available). */
export function OutlinePane({ slides, page }: { slides: string[][]; page: number }) {
  const lines = slides[page - 1] ?? [];
  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24 }}>
      {lines.length ? lines.map((l, i) => (
        <T key={i} v={i === 0 ? 'title' : 'body'} className={`${i === 0 ? '' : 'mt-2'} !text-[#172033]`}>{l}</T>
      )) : <T muted className="!text-[#6B7690]">(No text on this slide)</T>}
      <View className="h-6" />
    </ScrollView>
  );
}
