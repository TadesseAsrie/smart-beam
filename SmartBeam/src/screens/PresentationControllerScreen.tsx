import React, { useEffect, useRef, useState } from 'react';
import { Alert, PanResponder, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { ChevronLeft, ChevronRight, Eye, EyeOff, LayoutGrid, MonitorPlay, Pause, Play, Pointer, RotateCcw, RotateCw, Power, RefreshCw } from 'lucide-react-native';
import { Button, Card, EmptyState, IconButton, Screen, Sheet, T } from '../components/ui';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { SeekBar } from '../components/SeekBar';
import { ThumbGrid } from '../components/Thumbs';
import { useElapsed } from '../hooks/useTimer';
import { exitPresentation, goTo, nextSlide, pause, prevSlide, resume, retryOutput, setBlackout, setPointer, videoCommand } from '../presentation/controller';
import { usePresentation } from '../store/presentation';
import { useSettings } from '../store/settings';
import { formatDuration } from '../utils/format';

export function PresentationControllerScreen() {
  const nav = useNavigation<any>();
  const s = usePresentation();
  const { label } = useElapsed();
  const keepOn = useSettings((st) => st.keepScreenOn);
  const [grid, setGrid] = useState(false);
  const [laser, setLaser] = useState(false);
  const padSize = useRef({ w: 1, h: 1 });
  const laserRef = useRef(false);
  laserRef.current = laser;
  useKeepAwake();

  const pad = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => laserRef.current,
    onMoveShouldSetPanResponder: () => laserRef.current,
    onPanResponderGrant: (e) => setPointer(e.nativeEvent.locationX / padSize.current.w, e.nativeEvent.locationY / padSize.current.h, true),
    onPanResponderMove: (e) => setPointer(e.nativeEvent.locationX / padSize.current.w, e.nativeEvent.locationY / padSize.current.h, true),
    onPanResponderRelease: () => setPointer(0.5, 0.5, false),
    onPanResponderTerminate: () => setPointer(0.5, 0.5, false)
  })).current;

  useEffect(() => { if (s.status === 'idle') nav.goBack(); }, [s.status]); // eslint-disable-line

  const end = () => Alert.alert('End presentation?', 'The display will stop showing the content.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'End', style: 'destructive', onPress: async () => { await exitPresentation(); nav.goBack(); } }]);

  if (s.status !== 'live') return <Screen title="Controller"><EmptyState icon={MonitorPlay} title="No active presentation" message="Start a presentation from a file." actionLabel="Choose a file" onAction={() => nav.navigate('Tabs', { screen: 'Files' })} /></Screen>;

  const isVideo = s.kind === 'video';
  const isSlides = s.kind === 'pdf' || s.kind === 'outline';
  const dur = s.video.durationMs / 1000;

  return (
    <Screen title={s.file?.name ?? 'Controller'} back={false} right={<T v="label" className="mr-4">{label}</T>}>
      <Card className="mt-2"><ConnectionBanner compact /></Card>

      {s.outputError ? (
        <Card className="mt-3 border-danger">
          <T className="text-danger">{s.outputError}</T>
          <Button label="Retry" icon={RefreshCw} variant="secondary" small className="mt-2" onPress={() => retryOutput()} />
        </Card>
      ) : null}
      {s.outputMode !== 'external' && !s.outputError ? <Card className="mt-3"><T muted>Presenting on this phone only. Connect a projector to control an external screen.</T></Card> : null}

      <Card className="mt-3 items-center py-6">
        <T v="caption" muted>{isVideo ? 'Video' : 'Slide'}</T>
        {isSlides ? <T className="text-5xl font-bold mt-1">{s.page}<T muted className="text-2xl"> / {s.total}</T></T> : <T className="text-3xl font-bold mt-1">{formatDuration(s.video.positionMs / 1000)}</T>}
        {s.paused ? <T className="text-warn mt-1">Paused</T> : null}{s.blackout ? <T className="text-warn mt-1">Screen blacked out</T> : null}
      </Card>

      {isSlides ? (
        <View className="flex-row gap-3 mt-3">
          <Button label="Previous" icon={ChevronLeft} variant="secondary" className="flex-1 min-h-[72px]" disabled={s.page <= 1 || s.paused} onPress={prevSlide} />
          <Button label="Next" icon={ChevronRight} className="flex-1 min-h-[72px]" disabled={s.page >= s.total || s.paused} onPress={nextSlide} />
        </View>
      ) : null}

      {isVideo ? (
        <Card className="mt-3">
          <SeekBar value={dur ? s.video.positionMs / s.video.durationMs : 0} disabled={!dur} onCommit={(v) => videoCommand('seek', v * s.video.durationMs)} />
          <View className="flex-row justify-center gap-2">
            <IconButton icon={RotateCcw} label="Back 10 seconds" onPress={() => videoCommand('seek', Math.max(0, s.video.positionMs - 10000))} />
            <IconButton icon={s.video.playing ? Pause : Play} size={30} label={s.video.playing ? 'Pause video' : 'Play video'} onPress={() => videoCommand(s.video.playing ? 'pause' : 'play')} />
            <IconButton icon={RotateCw} label="Forward 10 seconds" onPress={() => videoCommand('seek', s.video.positionMs + 10000)} />
          </View>
        </Card>
      ) : null}

      <View className="flex-row flex-wrap gap-3 mt-3">
        <Button label={s.paused ? 'Resume' : 'Pause'} icon={s.paused ? Play : Pause} variant="secondary" className="flex-1" onPress={() => (s.paused ? resume() : pause())} />
        <Button label={s.blackout ? 'Show screen' : 'Blackout'} icon={s.blackout ? Eye : EyeOff} variant="secondary" className="flex-1" onPress={() => setBlackout(!s.blackout)} />
      </View>
      <View className="flex-row gap-3 mt-3">
        {s.kind === 'pdf' ? <Button label="Select slide" icon={LayoutGrid} variant="secondary" className="flex-1" onPress={() => setGrid(true)} /> : null}
        {isSlides ? <Button label="Presenter view" icon={MonitorPlay} variant="secondary" className="flex-1" onPress={() => nav.navigate('PresenterView')} /> : null}
      </View>

      {isSlides && s.outputMode === 'external' ? (
        <>
          <View className="flex-row items-center justify-between mt-5 mb-2"><T v="h2">Laser pointer</T><Button small label={laser ? 'On' : 'Off'} icon={Pointer} variant={laser ? 'primary' : 'secondary'} onPress={() => { setLaser((v) => !v); if (laser) setPointer(0.5, 0.5, false); }} /></View>
          <View {...pad.panHandlers} onLayout={(e) => { padSize.current = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 }; }}
            className={`h-44 rounded-2xl border-2 border-dashed items-center justify-center ${laser ? 'border-brand bg-brand/10' : 'border-line dark:border-lined'}`} accessibilityLabel="Laser pointer pad">
            <T muted>{laser ? 'Touch and drag to move the pointer' : 'Turn the laser on to use this pad'}</T>
          </View>
        </>
      ) : null}

      <Button label="End presentation" icon={Power} variant="danger" className="mt-6" onPress={end} />

      <Sheet visible={grid} onClose={() => setGrid(false)} title="Select slide">
        {s.path ? <ThumbGrid path={s.path} total={s.total} current={s.page} onSelect={(p) => { goTo(p); setGrid(false); }} /> : null}
      </Sheet>
    </Screen>
  );
}
