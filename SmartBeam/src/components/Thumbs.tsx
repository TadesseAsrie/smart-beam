import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { PdfNative } from '../native';
import { T } from './ui';

function Thumb({ path, index, selected, onPress, width }: { path: string; index: number; selected: boolean; onPress: () => void; width: number }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    PdfNative.renderThumbnail(path, index, width * 2).then((p) => { if (alive) setUri('file://' + p); }).catch(() => undefined);
    return () => { alive = false; };
  }, [path, index, width]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Slide ${index + 1}`} className="mr-2 items-center">
      <View style={{ width, height: width * 0.75 }} className={`rounded-lg overflow-hidden bg-line dark:bg-lined border-2 ${selected ? 'border-brand' : 'border-transparent'}`}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
      </View>
      <T v="caption" muted className="mt-1">{index + 1}</T>
    </Pressable>
  );
}

/** Horizontal strip of lazily rendered page thumbnails (rendered natively, cached on disk). */
export function ThumbStrip({ path, total, current, onSelect, width = 96 }: { path: string; total: number; current: number; onSelect: (page: number) => void; width?: number }) {
  return (
    <FlatList
      horizontal showsHorizontalScrollIndicator={false}
      data={Array.from({ length: total }, (_, i) => i)} keyExtractor={(i) => String(i)}
      initialNumToRender={6} windowSize={5} maxToRenderPerBatch={4}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
      renderItem={({ item }) => <Thumb path={path} index={item} width={width} selected={item + 1 === current} onPress={() => onSelect(item + 1)} />}
    />
  );
}

export function ThumbGrid({ path, total, current, onSelect }: { path: string; total: number; current: number; onSelect: (page: number) => void }) {
  return (
    <FlatList
      numColumns={3} data={Array.from({ length: total }, (_, i) => i)} keyExtractor={(i) => String(i)}
      columnWrapperStyle={{ gap: 8 }} contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
      initialNumToRender={9}
      renderItem={({ item }) => <Thumb path={path} index={item} width={96} selected={item + 1 === current} onPress={() => onSelect(item + 1)} />}
    />
  );
}
