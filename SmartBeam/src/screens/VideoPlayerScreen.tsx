import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { VideoRef } from 'react-native-video';
import { videoComponent } from '../native/lib';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Cast as CastIcon, ListVideo, Maximize, Pause, Play, RotateCcw, RotateCw, Subtitles, Volume2, VolumeX, X, SkipForward } from 'lucide-react-native';
import { Button, Chip, IconButton, Row, Sheet, T } from '../components/ui';
import { SeekBar } from '../components/SeekBar';
import { applyOrientation } from '../hooks/useDisplayPrefs';
import { exitPresentation, openPresentation, videoCommand } from '../presentation/controller';
import { pickSubtitle } from '../services/fileService';
import { useConnection } from '../store/connection';
import { useLibrary } from '../store/library';
import { usePresentation } from '../store/presentation';
import { useSettings } from '../store/settings';
import { palette } from '../theme/colors';
import { formatDuration } from '../utils/format';
import { isCancel, reportError } from '../utils/errors';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export function VideoPlayerScreen() {
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const files = useLibrary((s) => s.files);
  const keepOn = useSettings((s) => s.keepScreenOn);
  const orientationPref = useSettings((s) => s.orientation);
  const active = useConnection((s) => s.active);
  const live = usePresentation();
  const [playlist, setPlaylist] = useState<string[]>(params.playlist?.length ? params.playlist : [params.fileId]);
  const [idx, setIdx] = useState(Math.max(0, (params.playlist ?? [params.fileId]).indexOf(params.fileId)));
  const file = files.find((f) => f.id === playlist[idx]);
  const ref = useRef<VideoRef>(null);
  const Video = videoComponent();
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [sheet, setSheet] = useState<'playlist' | null>(null);
  const [sub, setSub] = useState<{ uri: string; type: 'text/vtt' | 'application/x-subrip'; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remote = live.status === 'live' && live.kind === 'video' && live.outputMode === 'external' && live.file?.id === file?.id;
  const advanced = useRef(-1);

  useKeepAwake();
  useEffect(() => () => { applyOrientation(orientationPref); }, [orientationPref]);

  // Start on the projector automatically when this screen was opened as a presentation.
  useEffect(() => { if (params.presenting && remote) setPaused(true); }, []); // eslint-disable-line

  const next = () => { if (idx < playlist.length - 1) { advanced.current = idx; setIdx(idx + 1); setPos(0); if (remote) openPresentation(files.find((f) => f.id === playlist[idx + 1])!, { playlist }).catch((e) => reportError(e)); } };

  // Auto-advance when the remote player reaches the end.
  useEffect(() => {
    if (remote && live.video.durationMs > 0 && live.video.positionMs >= live.video.durationMs - 800 && !live.video.playing && advanced.current !== idx) next();
  }); // eslint-disable-line

  const castHere = async () => {
    if (!file || !active) return;
    try { setPaused(true); await openPresentation(file, { playlist }); } catch (e) { reportError(e); setPaused(false); }
  };

  const position = remote ? live.video.positionMs / 1000 : pos;
  const duration = remote ? live.video.durationMs / 1000 : dur;
  const playing = remote ? live.video.playing : !paused;

  const toggle = () => { if (remote) videoCommand(playing ? 'pause' : 'play'); else setPaused((p) => !p); };
  const seekTo = (sec: number) => { const s = Math.max(0, Math.min(duration || sec, sec)); if (remote) videoCommand('seek', s * 1000); else { ref.current?.seek(s); setPos(s); } };
  const setVol = (v: number) => { setVolume(v); if (remote) videoCommand('volume', v); };
  const goFull = async () => { setChrome(false); try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch { /* ignore */ } };
  const close = async () => { if (live.status === 'live') await exitPresentation(); nav.goBack(); };

  if (!file) return <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: palette.bgd }}><T className="!text-white">Video unavailable.</T><Button label="Close" onPress={() => nav.goBack()} /></SafeAreaView>;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#000' }} edges={chrome ? ['top', 'bottom'] : []}>
      <StatusBar hidden={!chrome} style="light" />
      <Pressable className="flex-1" onPress={() => setChrome((c) => !c)} accessibilityLabel="Toggle controls">
        {error || !Video ? <View className="flex-1 items-center justify-center p-6"><T className="!text-white text-center">{error ?? 'The video player is not available in this build. Rebuild the app.'}</T></View> : (
          <Video
            key={file.id} ref={ref} source={{ uri: 'file://' + file.path }} style={{ flex: 1 }} resizeMode="contain"
            paused={remote ? true : paused} muted={remote} rate={rate} volume={volume} progressUpdateInterval={500}
            textTracks={sub ? [{ title: sub.name, language: 'und', type: sub.type === 'text/vtt' ? 'text/vtt' : ('application/x-subrip' as any), uri: sub.uri }] : undefined}
            selectedTextTrack={sub ? { type: 'index', value: 0 } : { type: 'disabled' } as any}
            onLoad={(d) => setDur(d.duration)} onProgress={(p) => setPos(p.currentTime)} onEnd={() => { if (idx < playlist.length - 1) next(); else setPaused(true); }}
            onError={() => setError('This video could not be played. The format or codec may not be supported on this phone.')}
          />
        )}
        {remote ? <View className="absolute top-4 left-0 right-0 items-center"><View className="bg-navy/80 rounded-full px-4 py-2"><T v="label" className="!text-white">Playing on {active?.name}</T></View></View> : null}
      </Pressable>

      {chrome ? (
        <View className="absolute inset-x-0 top-0 bottom-0" pointerEvents="box-none">
          <View className="flex-row items-center h-14 px-2" style={{ backgroundColor: '#000A' }}>
            <IconButton icon={X} tone="light" label="Close player" onPress={close} />
            <T v="label" className="flex-1 !text-white" numberOfLines={1}>{file.name}{playlist.length > 1 ? `  (${idx + 1}/${playlist.length})` : ''}</T>
            <IconButton icon={ListVideo} tone="light" label="Playlist" onPress={() => setSheet('playlist')} />
          </View>
          <View className="flex-1" pointerEvents="none" />
          <View className="px-4 pt-2 pb-4" style={{ backgroundColor: '#000B' }}>
            <SeekBar value={duration ? position / duration : 0} onCommit={(v) => seekTo(v * duration)} disabled={!duration} />
            <View className="flex-row justify-between"><T v="caption" className="!text-white">{formatDuration(position)}</T><T v="caption" className="!text-white">{formatDuration(duration)}</T></View>
            <View className="flex-row items-center justify-center gap-2">
              <IconButton icon={RotateCcw} tone="light" label="Back 10 seconds" onPress={() => seekTo(position - 10)} />
              <IconButton icon={playing ? Pause : Play} tone="light" size={32} label={playing ? 'Pause' : 'Play'} onPress={toggle} />
              <IconButton icon={RotateCw} tone="light" label="Forward 10 seconds" onPress={() => seekTo(position + 10)} />
              <IconButton icon={SkipForward} tone="light" label="Next video" onPress={next} />
            </View>
            <View className="flex-row items-center justify-around">
              <IconButton icon={volume === 0 ? VolumeX : Volume2} tone="light" label="Mute" onPress={() => setVol(volume === 0 ? 1 : 0)} />
              <Chip label="−" onPress={() => setVol(Math.max(0, +(volume - 0.1).toFixed(1)))} /><T v="caption" className="!text-white">{Math.round(volume * 100)}%</T><Chip label="+" onPress={() => setVol(Math.min(1, +(volume + 0.1).toFixed(1)))} />
              <IconButton icon={Subtitles} tone="light" label="Add subtitles" active={!!sub} onPress={async () => { try { const s = await pickSubtitle(); if (s) setSub(s); else reportError(new Error('Choose a .srt or .vtt subtitle file.')); } catch (e) { if (!isCancel(e)) reportError(e); } }} />
              <IconButton icon={Maximize} tone="light" label="Full screen" onPress={goFull} />
            </View>
            {!remote ? <View className="flex-row justify-center gap-2 mt-1">{SPEEDS.map((s) => <Chip key={s} label={`${s}×`} selected={rate === s} onPress={() => setRate(s)} />)}</View> : null}
            {active && !remote ? <Button label={`Play on ${active.name}`} icon={CastIcon} variant="secondary" className="mt-3" onPress={castHere} /> : null}
          </View>
        </View>
      ) : null}

      <Sheet visible={sheet === 'playlist'} onClose={() => setSheet(null)} title="Playlist">
        {playlist.map((id, i) => { const f = files.find((x) => x.id === id); return f ? <Row key={id} title={f.name} subtitle={i === idx ? 'Now playing' : undefined} onPress={() => { setIdx(i); setPos(0); setSheet(null); }}
          right={playlist.length > 1 ? <Button small variant="ghost" label="Remove" onPress={() => { const p = playlist.filter((x) => x !== id); setPlaylist(p); setIdx(Math.min(idx, p.length - 1)); }} /> : undefined} /> : null; })}
        <T v="label" className="mt-4 mb-1">Add from library</T>
        {files.filter((f) => f.kind === 'video' && !playlist.includes(f.id)).map((f) => <Row key={f.id} title={f.name} onPress={() => setPlaylist([...playlist, f.id])} />)}
        {!files.some((f) => f.kind === 'video' && !playlist.includes(f.id)) ? <T muted>No other videos in your library.</T> : null}
      </Sheet>
    </SafeAreaView>
  );
}
