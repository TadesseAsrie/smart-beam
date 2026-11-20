import React from 'react';
import { Pressable, View } from 'react-native';
import { FileText, Film, Image as ImageIcon, Monitor, Presentation, Star, Tv, Wifi, Cast as CastIcon, QrCode, Cable } from 'lucide-react-native';
import type { Device, FileKind, FileRecord, HistoryRecord } from '../types';
import { useColors } from '../theme/colors';
import { formatBytes, formatDuration, formatRelative } from '../utils/format';
import { KIND_LABEL } from '../utils/fileTypes';
import { StatusPill, T } from './ui';

export function kindIcon(kind: FileKind) {
  return { pdf: FileText, ppt: Presentation, doc: FileText, image: ImageIcon, video: Film }[kind];
}

export function FileRow({ file, onPress, onLongPress, onToggleFavorite, subtitle }: {
  file: FileRecord; onPress: () => void; onLongPress?: () => void; onToggleFavorite?: () => void; subtitle?: string;
}) {
  const c = useColors();
  const Icon = kindIcon(file.kind);
  return (
    <Pressable
      onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={`${file.name}, ${KIND_LABEL[file.kind]}`}
      className="flex-row items-center gap-3 rounded-2xl bg-surface dark:bg-surfd border border-line dark:border-lined p-3 mb-2 active:opacity-80"
    >
      <View className="h-12 w-12 rounded-xl bg-brand/10 items-center justify-center"><Icon size={22} color={c.brand} /></View>
      <View className="flex-1">
        <T v="label" numberOfLines={1}>{file.name}</T>
        <T v="caption" muted numberOfLines={1}>{subtitle ?? `${KIND_LABEL[file.kind]} · ${formatBytes(file.size)}`}</T>
      </View>
      {onToggleFavorite ? (
        <Pressable onPress={onToggleFavorite} hitSlop={10} accessibilityRole="button" accessibilityLabel={file.favorite ? 'Remove from favorites' : 'Add to favorites'} className="h-10 w-10 items-center justify-center">
          <Star size={20} color={file.favorite ? c.warn : c.muted} fill={file.favorite ? c.warn : 'transparent'} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function HistoryRow({ item, onPress }: { item: HistoryRecord; onPress: () => void }) {
  const c = useColors();
  const Icon = kindIcon(item.fileKind);
  const progress = item.totalSlides > 1 ? ` · slide ${item.lastSlide}/${item.totalSlides}` : '';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-3 rounded-2xl bg-surface dark:bg-surfd border border-line dark:border-lined p-3 mb-2 active:opacity-80">
      <View className="h-12 w-12 rounded-xl bg-cyan/15 items-center justify-center"><Icon size={22} color={c.cyan} /></View>
      <View className="flex-1">
        <T v="label" numberOfLines={1}>{item.fileName}</T>
        <T v="caption" muted>{formatRelative(item.presentedAt)}{progress} · {formatDuration(item.durationSec)}</T>
      </View>
      {item.favorite ? <Star size={16} color={c.warn} fill={c.warn} /> : null}
    </Pressable>
  );
}

export function protocolIcon(adapterId: Device['adapterId']) {
  return { 'google-cast': CastIcon, miracast: Wifi, 'external-display': Cable, 'cloud-room': QrCode }[adapterId];
}

export function DeviceRow({ device, onPress, right }: { device: Device; onPress: () => void; right?: React.ReactNode }) {
  const c = useColors();
  const Icon = protocolIcon(device.adapterId) ?? (device.adapterId === 'external-display' ? Monitor : Tv);
  const tone = device.state === 'connected' ? 'success' : device.state === 'connecting' ? 'info' : device.state === 'unavailable' ? 'danger' : 'neutral';
  const label = device.state === 'connected' ? 'Connected' : device.state === 'connecting' ? 'Connecting…' : device.state === 'unavailable' ? 'Unavailable' : device.adapterId === 'miracast' ? 'Guided setup' : 'Available';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${device.name}, ${device.protocol}, ${label}`} className="flex-row items-center gap-3 rounded-2xl bg-surface dark:bg-surfd border border-line dark:border-lined p-3 mb-2 active:opacity-80">
      <View className="h-12 w-12 rounded-xl bg-brand/10 items-center justify-center"><Icon size={22} color={c.brand} /></View>
      <View className="flex-1 gap-0.5">
        <T v="label" numberOfLines={1}>{device.name}</T>
        <T v="caption" muted numberOfLines={1}>{device.protocol}</T>
      </View>
      {right ?? <StatusPill tone={tone} label={label} />}
    </Pressable>
  );
}
