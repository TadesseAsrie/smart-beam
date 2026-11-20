import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

/** Minimal touch slider (tap or drag) — avoids an extra native slider dependency. */
export function SeekBar({ value, onChange, onCommit, disabled }: { value: number; onChange?: (v: number) => void; onCommit: (v: number) => void; disabled?: boolean }) {
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const widthRef = useRef(1);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { const v = Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current)); setDrag(v); onChange?.(v); },
    onPanResponderMove: (e) => { const v = Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current)); setDrag(v); onChange?.(v); },
    onPanResponderRelease: (e) => { const v = Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current)); setDrag(null); onCommit(v); }
  })).current;
  const shown = drag ?? value;
  return (
    <View
      {...(disabled ? {} : pan.panHandlers)}
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width || 1; setWidth(e.nativeEvent.layout.width || 1); }}
      className="h-10 justify-center" accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 100, now: Math.round(shown * 100) }}
    >
      <View className="h-1.5 rounded-full bg-line dark:bg-lined overflow-hidden">
        <View className="h-full bg-brand" style={{ width: shown * width }} />
      </View>
      <View className="absolute h-4 w-4 rounded-full bg-brand" style={{ left: Math.max(0, shown * width - 8) }} />
    </View>
  );
}
