import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ChevronLeft, ChevronRight, Hash, LayoutGrid, Maximize, Minimize, Presentation, RotateCw, StickyNote, X, ZoomIn, ZoomOut, Scan } from 'lucide-react-native';
import { Button, Card, IconButton, LoadingState, PromptDialog, Screen, T } from '../components/ui';
import { OutlinePane, PdfPane } from '../components/PdfPane';
import { ThumbStrip } from '../components/Thumbs';
import { useElapsed } from '../hooks/useTimer';
import { applyOrientation } from '../hooks/useDisplayPrefs';
import { prepareConverted, type ConvertResult } from '../services/convertService';
import { exitPresentation, goTo } from '../presentation/controller';
import { beginPresenting } from '../presentation/launch';
import { useLibrary } from '../store/library';
import { usePresentation } from '../store/presentation';
import { useSettings } from '../store/settings';
import { formatDuration } from '../utils/format';
import { reportError, userMessage } from '../utils/errors';
import { palette } from '../theme/colors';

function LocalClock() {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  return <T v="label" className="!text-white">{formatDuration(s)}</T>;
}
function LiveClock() { const { label } = useElapsed(); return <T v="label" className="!text-white">{label}</T>; }

function DocumentViewer({ mode }: { mode: 'pdf' | 'ppt' }) {
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const file = useLibrary((s) => s.files.find((f) => f.id === params.fileId));
  const presenting: boolean = !!params.presenting;
  const live = usePresentation();
  const keepOn = useSettings((s) => s.keepScreenOn);
  const [conv, setConv] = useState<ConvertResult | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(params.startPage ?? 1);
  const [total, setTotal] = useState(1);
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState<'both' | 'width'>('both');
  const [chrome, setChrome] = useState(true);
  const [thumbs, setThumbs] = useState(false);
  const [jump, setJump] = useState(false);
  const [notes, setNotes] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [warn, setWarn] = useState(true);
  const defaultOrientation = useSettings((s) => s.orientation);

  useEffect(() => {
    if (!(presenting && keepOn)) return;
    activateKeepAwakeAsync('smartbeam-doc');
    return () => { deactivateKeepAwake('smartbeam-doc'); };
  }, [presenting, keepOn]);

  useEffect(() => () => { applyOrientation(defaultOrientation); }, [defaultOrientation]);

  useEffect(() => {
    if (!file) return;
    if (mode === 'ppt' && !presenting) {
      setPreparing(true);
      prepareConverted(file).then((r) => { setConv(r); setTotal(r.outline?.length ?? total); }).catch((e) => setError(userMessage(e))).finally(() => setPreparing(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  // When presenting, the page and notes come from the live session.
  const pdfPath = presenting ? (live.kind === 'pdf' ? live.path : null) : mode === 'pdf' ? file?.path ?? null : conv?.pdfPath ?? null;
  const outline = presenting ? (live.kind === 'outline' ? live.outline : null) : conv?.outline ?? null;
  const curPage = presenting ? live.page : page;
  const curTotal = presenting ? live.total : outline ? outline.length : total;
  const noteList = presenting ? live.notes : conv?.notes ?? [];
  const warnings = presenting ? live.warnings : conv?.warnings ?? [];

  const setPageSafe = useCallback((p: number) => {
    const n = Math.min(Math.max(1, p), Math.max(1, curTotal));
    if (presenting) goTo(n); else setPage(n);
  }, [presenting, curTotal]);

  useFocusEffect(useCallback(() => { /* nothing: keeps viewer state while focused */ return undefined; }, []));

  const toggleLandscape = async () => {
    const next = !landscape; setLandscape(next);
    try { await ScreenOrientation.lockAsync(next ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP); } catch { /* ignore */ }
  };

  const close = async () => { if (presenting) await exitPresentation(); nav.goBack(); };

  if (!file) return <Screen title="Document"><T muted>This file is no longer available.</T></Screen>;
  const isImage = file.kind === 'image';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.bgd }} edges={chrome ? ['top', 'bottom'] : []}>
      <StatusBar hidden={!chrome} style="light" />
      {chrome ? (
        <View className="flex-row items-center h-14 px-2">
          <IconButton icon={X} tone="light" label={presenting ? 'End presentation' : 'Close'} onPress={close} />
          <T v="label" className="flex-1 !text-white" numberOfLines={1}>{file.name}</T>
          {presenting ? <LiveClock /> : <LocalClock />}
          {!presenting && !isImage ? <Button label="Present" icon={Presentation} small className="ml-2" onPress={() => beginPresenting(file, nav, { startPage: curPage })} /> : null}
        </View>
      ) : null}

      {preparing ? <View className="flex-1 items-center justify-center"><LoadingState label="Preparing slides…" /></View>
        : error ? <View className="flex-1 items-center justify-center p-6"><T className="!text-white text-center">{error}</T><Button label="Close" className="mt-4" onPress={() => nav.goBack()} /></View>
        : (
          <Pressable className="flex-1" onPress={() => setChrome((c) => !c)} accessibilityLabel="Toggle controls">
            <View className="flex-1" pointerEvents={isImage || outline ? 'none' : 'auto'}>
              {isImage ? <Image source={{ uri: 'file://' + file.path }} resizeMode="contain" style={{ flex: 1 }} />
                : outline ? <OutlinePane slides={outline} page={curPage} />
                : pdfPath ? <PdfPane path={pdfPath} page={curPage} scale={scale} fit={fit} onScale={setScale} onLoaded={setTotal} onPage={(p, t) => { setTotal(t); if (p !== curPage) setPageSafe(p); }} onError={(m) => setError(m)} />
                : null}
            </View>
          </Pressable>
        )}

      {chrome && !preparing && !error ? (
        <View>
          {warnings.length && warn ? (
            <Card className="mx-3 mb-2"><View className="flex-row"><View className="flex-1">{warnings.slice(0, 3).map((w, i) => <T key={i} v="caption" muted className="mb-1">• {w}</T>)}</View><IconButton icon={X} size={18} label="Dismiss notice" onPress={() => setWarn(false)} /></View></Card>
          ) : null}
          {notes ? <ScrollView className="max-h-32 mx-3 mb-2 rounded-xl bg-surfd p-3"><T className="!text-white">{noteList[curPage - 1] || 'No speaker notes for this slide.'}</T></ScrollView> : null}
          {thumbs && pdfPath ? <ThumbStrip path={pdfPath} total={curTotal} current={curPage} onSelect={setPageSafe} /> : null}
          {!isImage ? (
            <View className="flex-row items-center justify-between px-2 pb-1">
              <IconButton icon={ChevronLeft} tone="light" label="Previous page" onPress={() => setPageSafe(curPage - 1)} />
              <Pressable onPress={() => setJump(true)} accessibilityRole="button" accessibilityLabel="Jump to page" className="px-4 h-12 justify-center"><T v="label" className="!text-white">{curPage} / {curTotal}</T></Pressable>
              <IconButton icon={ChevronRight} tone="light" label="Next page" onPress={() => setPageSafe(curPage + 1)} />
            </View>
          ) : null}
          <View className="flex-row items-center justify-around pb-2">
            {pdfPath ? <IconButton icon={LayoutGrid} tone="light" label="Thumbnails" active={thumbs} onPress={() => setThumbs((v) => !v)} /> : null}
            {pdfPath ? <IconButton icon={ZoomOut} tone="light" label="Zoom out" onPress={() => setScale((s) => Math.max(1, s - 0.5))} /> : null}
            {pdfPath ? <IconButton icon={ZoomIn} tone="light" label="Zoom in" onPress={() => setScale((s) => Math.min(4, s + 0.5))} /> : null}
            {pdfPath ? <IconButton icon={Scan} tone="light" label="Fit to screen" onPress={() => { setScale(1); setFit('both'); }} /> : null}
            {noteList.some(Boolean) ? <IconButton icon={StickyNote} tone="light" label="Speaker notes" active={notes} onPress={() => setNotes((v) => !v)} /> : null}
            <IconButton icon={RotateCw} tone="light" label="Toggle landscape" active={landscape} onPress={toggleLandscape} />
            <IconButton icon={chrome ? Maximize : Minimize} tone="light" label="Full screen" onPress={() => setChrome(false)} />
          </View>
        </View>
      ) : null}

      <PromptDialog visible={jump} title={`Go to page (1–${curTotal})`} initial={String(curPage)} confirmLabel="Go" onCancel={() => setJump(false)}
        onSubmit={(v) => { const n = parseInt(v, 10); setJump(false); if (Number.isFinite(n)) setPageSafe(n); }} />
    </SafeAreaView>
  );
}

export const PdfViewerScreen = () => <DocumentViewer mode="pdf" />;
export const PptViewerScreen = () => <DocumentViewer mode="ppt" />;
