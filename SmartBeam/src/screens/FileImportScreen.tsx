import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, ChevronLeft, Folder, FileUp, FolderPlus } from 'lucide-react-native';
import { Button, Card, EmptyState, LoadingState, Row, Screen, SectionHeader, T } from '../components/ui';
import { Files, type TreeEntry } from '../native';
import { listFolder, pickDocuments } from '../services/fileService';
import { useLibrary } from '../store/library';
import { formatBytes } from '../utils/format';
import { isCancel, reportError } from '../utils/errors';
import { useUi } from '../store/ui';

export function FileImportScreen() {
  const nav = useNavigation<any>();
  const importFiles = useLibrary((s) => s.importFiles);
  const toast = useUi((s) => s.show);
  const [trees, setTrees] = useState<{ uri: string; name: string }[]>([]);
  const [stack, setStack] = useState<{ uri: string; name: string }[]>([]);
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, TreeEntry>>({});
  const [busy, setBusy] = useState(false);

  const loadTrees = () => Files.persistedTrees().then(setTrees).catch(() => setTrees([]));
  useEffect(() => { loadTrees(); }, []);

  const open = async (t: { uri: string; name: string }, push = true) => {
    setLoading(true);
    try { setEntries(await listFolder(t.uri)); setStack((s) => (push ? [...s, t] : s)); } catch (e) { reportError(e); }
    setLoading(false);
  };
  const up = () => { const s = stack.slice(0, -1); setStack(s); setPicked({}); if (s.length) open(s[s.length - 1], false); else setEntries([]); };

  const done = (n: number, skipped: string[]) => {
    toast(n ? `Imported ${n} file${n > 1 ? 's' : ''}${skipped.length ? `, skipped ${skipped.length}` : ''}.` : `Nothing imported${skipped.length ? ': unsupported or unreadable files.' : '.'}`, n ? 'success' : 'error');
    if (n) nav.goBack();
  };

  const pick = async () => {
    setBusy(true);
    try { const r = await pickDocuments(); if (r.length) { const res = await importFiles(r); done(res.imported.length, res.skipped); } }
    catch (e) { if (!isCancel(e)) reportError(e); }
    setBusy(false);
  };

  const addFolder = async () => {
    try { const t = await Files.pickTree(); await loadTrees(); open(t); } catch (e) { if (!isCancel(e)) reportError(e); }
  };

  const importPicked = async () => {
    setBusy(true);
    const res = await importFiles(Object.values(picked).map((e) => ({ uri: e.uri, name: e.name })));
    setBusy(false); done(res.imported.length, res.skipped);
  };

  const count = Object.keys(picked).length;
  return (
    <Screen title="Import files" footer={count ? <View className="p-4"><Button label={`Import ${count} selected`} loading={busy} onPress={importPicked} /></View> : null}>
      <Card className="mt-2">
        <T v="h2">Choose files</T>
        <T muted className="mt-1">Opens Android's file picker. No storage permission is needed.</T>
        <Button label="Open file picker" icon={FileUp} className="mt-3" loading={busy && !count} onPress={pick} />
        <T v="caption" muted className="mt-2">PDF, PPT, PPTX, DOC, DOCX, JPG, JPEG, PNG, MP4, MOV</T>
      </Card>

      <SectionHeader title="Browse folders" action="Add folder" onAction={addFolder} />
      {stack.length ? (
        <>
          <Button label={`Back from ${stack[stack.length - 1].name}`} icon={ChevronLeft} variant="ghost" onPress={up} />
          {loading ? <LoadingState label="Reading folder…" /> : entries.length ? entries.map((e) => (
            <Row key={e.uri} icon={e.isDir ? Folder : undefined} title={e.name} subtitle={e.isDir ? 'Folder' : formatBytes(e.size)}
              right={!e.isDir ? (picked[e.uri] ? <Check size={20} color="#3867F5" /> : null) : undefined}
              onPress={() => (e.isDir ? open({ uri: e.uri, name: e.name }) : setPicked((p) => { const n = { ...p }; if (n[e.uri]) delete n[e.uri]; else n[e.uri] = e; return n; }))} />
          )) : <T muted>No supported files in this folder.</T>}
        </>
      ) : trees.length ? trees.map((t) => <Row key={t.uri} icon={Folder} title={t.name} subtitle="Granted folder" onPress={() => open(t)} />)
        : <EmptyState icon={FolderPlus} title="No folders granted" message="Grant a folder (like Documents or Downloads) so SmartBeam can list its presentations." actionLabel="Grant a folder" onAction={addFolder} />}
    </Screen>
  );
}
