import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FilePlus, FolderPlus, FolderOpen, Search } from 'lucide-react-native';
import { Button, Chip, EmptyState, PromptDialog, Row, Sheet, SkeletonRows, T } from '../components/ui';
import { FileRow } from '../components/rows';
import { beginPresenting, openFile } from '../presentation/launch';
import { useLibrary } from '../store/library';
import { useColors } from '../theme/colors';
import type { FileKind, FileRecord } from '../types';
import { KIND_LABEL } from '../utils/fileTypes';
import { formatBytes, formatDate } from '../utils/format';
import { reportError } from '../utils/errors';

type Filter = 'all' | 'recent' | 'favorites' | FileKind;
type Sort = 'name' | 'size' | 'date';

export function FileManagerScreen() {
  const nav = useNavigation<any>();
  const c = useColors();
  const { files, folders, ready, toggleFavorite, rename, remove, moveToFolder, createFolder, deleteFolder } = useLibrary();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('date');
  const [asc, setAsc] = useState(false);
  const [folder, setFolder] = useState<string | 'none' | null>(null);
  const [selected, setSelected] = useState<FileRecord | null>(null);
  const [dialog, setDialog] = useState<'rename' | 'folder' | 'move' | 'info' | null>(null);

  const list = useMemo(() => {
    let r = files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));
    if (filter === 'favorites') r = r.filter((f) => f.favorite);
    else if (filter === 'recent') r = r.filter((f) => f.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
    else if (filter !== 'all') r = r.filter((f) => f.kind === filter);
    if (folder === 'none') r = r.filter((f) => !f.folderId);
    else if (folder) r = r.filter((f) => f.folderId === folder);
    if (filter !== 'recent') {
      const dir = asc ? 1 : -1;
      r = [...r].sort((a, b) => dir * (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? a.size - b.size : a.importedAt - b.importedAt));
    }
    return r;
  }, [files, query, filter, sort, asc, folder]);

  const safe = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { reportError(e); } };
  const confirmDelete = (f: FileRecord) => Alert.alert('Delete file?', `"${f.name}" will be removed from SmartBeam. The original on your device is not touched.`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { setSelected(null); setDialog(null); safe(() => remove(f.id)); } }]);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bgd" edges={['top']}>
      <View className="px-5 pt-4 flex-row items-center">
        <T v="title" className="flex-1">Files</T>
        <Button label="Import" icon={FilePlus} small onPress={() => nav.navigate('FileImport')} />
      </View>
      <View className="mx-5 mt-3 h-12 rounded-xl border border-line dark:border-lined bg-surface dark:bg-surfd flex-row items-center px-3 gap-2">
        <Search size={18} color={c.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search files" placeholderTextColor={c.muted} style={{ color: c.ink }} className="flex-1" accessibilityLabel="Search files" />
      </View>
      <View style={{ height: 56 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}>
        {([['all', 'All'], ['recent', 'Recent'], ['favorites', 'Favorites'], ['pdf', 'PDF'], ['ppt', 'Slides'], ['doc', 'Docs'], ['image', 'Images'], ['video', 'Video']] as [Filter, string][]).map(([k, l]) => <Chip key={k} label={l} selected={filter === k} onPress={() => setFilter(k)} />)}
      </ScrollView></View>
      <View className="flex-row items-center px-5 gap-2 mb-2">
        <T v="caption" muted>Sort</T>
        {(['name', 'size', 'date'] as Sort[]).map((s) => <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} selected={sort === s} onPress={() => (sort === s ? setAsc(!asc) : (setSort(s), setAsc(s === 'name')))} />)}
        <T v="caption" muted>{asc ? '↑' : '↓'}</T>
      </View>
      <View style={{ height: 52 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}>
        <Chip label="All folders" icon={FolderOpen} selected={folder === null} onPress={() => setFolder(null)} />
        <Chip label="No folder" selected={folder === 'none'} onPress={() => setFolder('none')} />
        {folders.map((f) => <Chip key={f.id} label={f.name} selected={folder === f.id} onPress={() => setFolder(f.id)} />)}
        <Chip label="New folder" icon={FolderPlus} onPress={() => setDialog('folder')} />
      </ScrollView></View>
      {folder && folder !== 'none' ? <View className="px-5 pb-1 flex-row gap-3"><Button small variant="ghost" label="Delete this folder" onPress={() => Alert.alert('Delete folder?', 'Files inside are kept and moved out of the folder.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { safe(() => deleteFolder(folder)); setFolder(null); } }])} /></View> : null}

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {!ready ? <SkeletonRows /> : list.length ? list.map((f) => (
          <FileRow key={f.id} file={f} onPress={() => openFile(f, nav)} onLongPress={() => { setSelected(f); setDialog(null); }} onToggleFavorite={() => safe(() => toggleFavorite(f.id))} />
        )) : <EmptyState icon={FolderOpen} title={files.length ? 'No matching files' : 'No files yet'} message={files.length ? 'Try another search or filter.' : 'Import PDFs, presentations, documents, images or videos to get started.'} actionLabel={files.length ? undefined : 'Import files'} onAction={() => nav.navigate('FileImport')} />}
      </ScrollView>

      <Sheet visible={!!selected && !dialog} onClose={() => setSelected(null)} title={selected?.name}>
        {selected ? <>
          <Row title="Open" onPress={() => { const f = selected; setSelected(null); openFile(f, nav); }} />
          <Row title="Present" onPress={() => { const f = selected; setSelected(null); beginPresenting(f, nav); }} />
          <Row title={selected.favorite ? 'Remove from favorites' : 'Add to favorites'} onPress={() => { safe(() => toggleFavorite(selected.id)); setSelected(null); }} />
          <Row title="Rename" onPress={() => setDialog('rename')} />
          <Row title="Move to folder" onPress={() => setDialog('move')} />
          <Row title="File information" onPress={() => setDialog('info')} />
          <Row title="Delete" tone="danger" onPress={() => confirmDelete(selected)} />
        </> : null}
      </Sheet>

      <PromptDialog visible={dialog === 'rename'} title="Rename file" initial={selected?.name.replace(/\.[^.]+$/, '') ?? ''} onCancel={() => setDialog(null)} onSubmit={(v) => { const f = selected!; setDialog(null); setSelected(null); safe(() => rename(f.id, v)); }} />
      <PromptDialog visible={dialog === 'folder'} title="New presentation folder" placeholder="Folder name" confirmLabel="Create" onCancel={() => setDialog(null)} onSubmit={(v) => { setDialog(null); safe(() => createFolder(v)); }} />
      <Sheet visible={dialog === 'move'} onClose={() => setDialog(null)} title="Move to folder">
        <Row title="No folder" onPress={() => { safe(() => moveToFolder(selected!.id, null)); setDialog(null); setSelected(null); }} />
        {folders.map((f) => <Row key={f.id} title={f.name} onPress={() => { safe(() => moveToFolder(selected!.id, f.id)); setDialog(null); setSelected(null); }} />)}
        {!folders.length ? <T muted>Create a folder first.</T> : null}
      </Sheet>
      <Sheet visible={dialog === 'info'} onClose={() => { setDialog(null); setSelected(null); }} title="File information">
        {selected ? <>
          <Row title="Name" subtitle={selected.name} /><Row title="Type" subtitle={`${KIND_LABEL[selected.kind]} (.${selected.ext})`} />
          <Row title="Size" subtitle={formatBytes(selected.size)} /><Row title="Imported" subtitle={formatDate(selected.importedAt)} />
          <Row title="Last modified" subtitle={formatDate(selected.modifiedAt)} />
          <Row title="Stored at" subtitle="App-private storage (a managed copy)" />
        </> : null}
      </Sheet>
    </SafeAreaView>
  );
}
