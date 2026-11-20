import React, { useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Button, Card, EmptyState, Screen, T } from '../components/ui';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { PdfNative } from '../native';
import { useElapsed } from '../hooks/useTimer';
import { nextSlide, prevSlide } from '../presentation/controller';
import { usePresentation } from '../store/presentation';
import { MonitorPlay } from 'lucide-react-native';

function Preview({ path, page, label }: { path: string | null; page: number; label: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true; setUri(null);
    if (path && page >= 1) PdfNative.renderThumbnail(path, page - 1, 720).then((p) => alive && setUri('file://' + p)).catch(() => undefined);
    return () => { alive = false; };
  }, [path, page]);
  return (
    <View className="flex-1">
      <T v="caption" muted className="mb-1">{label}</T>
      <View className="aspect-[4/3] rounded-xl overflow-hidden bg-line dark:bg-lined items-center justify-center">
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <T v="caption" muted>{path ? '…' : '—'}</T>}
      </View>
    </View>
  );
}

export function PresenterViewScreen() {
  const nav = useNavigation<any>();
  const s = usePresentation();
  const { label } = useElapsed();
  if (s.status !== 'live') return <Screen title="Presenter view"><EmptyState icon={MonitorPlay} title="No active presentation" message="Start presenting to use the presenter view." /></Screen>;
  const hasNext = s.page < s.total;
  const note = s.notes[s.page - 1];
  return (
    <Screen title="Presenter view" right={<T v="label" className="mr-4">{label}</T>}>
      <Card className="mt-2"><ConnectionBanner compact /></Card>
      <View className="flex-row gap-3 mt-3">
        {s.kind === 'outline' ? (
          <Card className="flex-1"><T v="caption" muted>Current</T>{(s.outline[s.page - 1] ?? []).slice(0, 6).map((l, i) => <T key={i} numberOfLines={2}>{l}</T>)}</Card>
        ) : <Preview path={s.path} page={s.page} label="Current" />}
        {s.kind === 'pdf' ? <Preview path={hasNext ? s.path : null} page={s.page + 1} label={hasNext ? 'Next' : 'Last slide'} /> : null}
      </View>
      <T v="caption" muted className="mt-2 text-center">Slide {s.page} of {s.total}{s.paused ? ' · Paused' : ''}</T>
      <T v="h2" className="mt-4 mb-2">Speaker notes</T>
      <Card><ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled><T muted={!note}>{note || 'No speaker notes for this slide. Notes are available for PPTX files converted with the SmartBeam server or read on-device.'}</T></ScrollView></Card>
      <View className="flex-row gap-3 mt-4">
        <Button label="Previous" icon={ChevronLeft} variant="secondary" className="flex-1 min-h-[64px]" disabled={s.page <= 1 || s.paused} onPress={prevSlide} />
        <Button label="Next" icon={ChevronRight} className="flex-1 min-h-[64px]" disabled={!hasNext || s.paused} onPress={nextSlide} />
      </View>
      <Button label="Open remote controls" variant="ghost" className="mt-3" onPress={() => nav.navigate('PresentationController')} />
    </Screen>
  );
}
