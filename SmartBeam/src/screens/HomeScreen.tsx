import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FileUp, FolderOpen, Presentation, Projector, Zap } from 'lucide-react-native';
import { Button, Card, EmptyState, ProgressBar, Screen, SectionHeader, Sheet, T } from '../components/ui';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { DeviceRow, FileRow, HistoryRow } from '../components/rows';
import { connectionManager } from '../connection';
import { System } from '../native';
import { beginPresenting, openFile, resumePresenting } from '../presentation/launch';
import { useConnection } from '../store/connection';
import { useLibrary } from '../store/library';
import { formatBytes } from '../utils/format';
import { reportError } from '../utils/errors';

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

export function HomeScreen() {
  const nav = useNavigation<any>();
  const { files, history, toggleFavorite } = useLibrary();
  const { status, active, devices } = useConnection();
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<{ total: number; free: number; appUsed: number } | null>(null);

  useEffect(() => { System.getStorageInfo().then(setStorage).catch(() => setStorage(null)); }, [files.length]);

  const recentFiles = useMemo(() => files.filter((f) => f.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)).slice(0, 4), [files]);
  const favorites = useMemo(() => files.filter((f) => f.favorite).slice(0, 3), [files]);
  const presentable = useMemo(() => files.filter((f) => f.kind !== 'image' || true), [files]);

  const quickConnect = async () => {
    setBusy(true);
    try { const ok = await connectionManager.autoReconnect(); if (!ok) nav.navigate('Connect'); } catch (e) { reportError(e); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <View className="flex-row items-center gap-3 pt-4">
        <View className="h-12 w-12 rounded-2xl bg-brand items-center justify-center"><Projector size={26} color="#fff" /></View>
        <View className="flex-1"><T v="title">SmartBeam</T><T muted>{greeting()} — ready to present?</T></View>
      </View>

      <Card className="mt-5">
        <ConnectionBanner />
        <View className="flex-row gap-3 mt-4">
          {status === 'connected' && active
            ? <Button label="Disconnect" variant="secondary" className="flex-1" onPress={() => connectionManager.disconnect()} />
            : <Button label="Quick Connect" icon={Zap} className="flex-1" loading={busy || status === 'connecting'} onPress={quickConnect} />}
          <Button label="Connect" variant="secondary" className="flex-1" onPress={() => nav.navigate('Connect')} />
        </View>
      </Card>

      <View className="flex-row gap-3 mt-4">
        <Button label="Open File" icon={FileUp} variant="secondary" className="flex-1" onPress={() => nav.navigate('FileImport')} />
        <Button label="Start Presentation" icon={Presentation} className="flex-1" onPress={() => (files.length ? setPicker(true) : nav.navigate('FileImport'))} />
      </View>

      <SectionHeader title="Recent presentations" action={history.length ? 'See all' : undefined} onAction={() => nav.navigate('History')} />
      {history.length ? history.slice(0, 3).map((h) => <HistoryRow key={h.id} item={h} onPress={() => resumePresenting(h, files, nav)} />)
        : <EmptyState icon={Presentation} title="No presentations yet" message="Your presented files will appear here so you can resume them." />}

      {recentFiles.length ? <><SectionHeader title="Recently opened files" />{recentFiles.map((f) => <FileRow key={f.id} file={f} onPress={() => openFile(f, nav)} onToggleFavorite={() => toggleFavorite(f.id)} />)}</> : null}

      <SectionHeader title="Favorites" action={favorites.length ? 'See all' : undefined} onAction={() => nav.navigate('Favorites')} />
      {favorites.length ? favorites.map((f) => <FileRow key={f.id} file={f} onPress={() => openFile(f, nav)} onToggleFavorite={() => toggleFavorite(f.id)} />)
        : <T muted>Tap the star on a file to keep it here.</T>}

      <SectionHeader title="Available projectors" action="See all" onAction={() => nav.navigate('AvailableDevices')} />
      {devices.filter((d) => d.adapterId !== 'miracast').length
        ? devices.filter((d) => d.adapterId !== 'miracast').slice(0, 3).map((d) => <DeviceRow key={d.id} device={d} onPress={() => nav.navigate('DeviceDetails', { deviceId: d.id })} />)
        : <T muted>Nothing discovered yet. Open the Connect tab to search.</T>}

      <SectionHeader title="Storage" />
      <Card>
        {storage ? (<>
          <View className="flex-row justify-between mb-2"><T v="label">SmartBeam files</T><T v="label">{formatBytes(storage.appUsed)}</T></View>
          <ProgressBar value={storage.total ? storage.appUsed / storage.total : 0} />
          <T v="caption" muted className="mt-2">{formatBytes(storage.free)} free of {formatBytes(storage.total)}</T>
        </>) : <T muted>Storage information is unavailable.</T>}
      </Card>

      <Sheet visible={picker} onClose={() => setPicker(false)} title="Choose a file to present">
        {presentable.map((f) => <FileRow key={f.id} file={f} onPress={() => { setPicker(false); beginPresenting(f, nav); }} />)}
        <Button label="Browse files" variant="ghost" icon={FolderOpen} onPress={() => { setPicker(false); nav.navigate('Files'); }} />
      </Sheet>
    </Screen>
  );
}
