import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SegmentedButtons, Switch } from 'react-native-paper';
import { FileText, FolderX, HelpCircle, Info, Shield, Trash2 } from 'lucide-react-native';
import { Button, Card, Chip, Row, SectionHeader, Sheet, T } from '../components/ui';
import { Files, System } from '../native';
import { PERMISSION_EXPLANATIONS, PRIVACY_POLICY } from '../content/privacy';
import { useLibrary } from '../store/library';
import { useSettings, type ConnectionPref } from '../store/settings';
import { useUi } from '../store/ui';
import { palette, useColors } from '../theme/colors';
import { formatBytes } from '../utils/format';
import { reportError } from '../utils/errors';

const pkg = require('../../package.json');
const PREFS: [ConnectionPref, string][] = [['ask', 'Ask each time'], ['google-cast', 'Google Cast'], ['external-display', 'External display'], ['cloud-room', 'QR room'], ['miracast', 'Miracast guide']];

export function SettingsScreen() {
  const nav = useNavigation<any>();
  const c = useColors();
  const st = useSettings();
  const { clearHistory, clearConversions } = useLibrary();
  const toast = useUi((s) => s.show);
  const [used, setUsed] = useState<number | null>(null);
  const [trees, setTrees] = useState<{ uri: string; name: string }[]>([]);
  const [sheet, setSheet] = useState<'privacy' | 'permissions' | 'about' | null>(null);
  const refresh = () => { System.getStorageInfo().then((s) => setUsed(s.appUsed)).catch(() => setUsed(null)); Files.persistedTrees().then(setTrees).catch(() => setTrees([])); };
  useEffect(refresh, []);

  const confirm = (title: string, msg: string, fn: () => Promise<unknown>) => Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: 'destructive', onPress: () => fn().then(refresh).catch((e) => reportError(e)) }]);
  const input = 'h-12 rounded-xl border border-line dark:border-lined px-3 mt-2';

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bgd" edges={['top']}>
      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <T v="title" className="pt-4">Settings</T>

        <SectionHeader title="Appearance" />
        <Card>
          <T v="label" className="mb-2">Theme</T>
          <SegmentedButtons value={st.theme} onValueChange={(v) => st.set({ theme: v as any })} buttons={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          <T v="label" className="mt-4 mb-2">Default orientation</T>
          <SegmentedButtons value={st.orientation} onValueChange={(v) => st.set({ orientation: v as any })} buttons={[{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
        </Card>

        <SectionHeader title="Connection" />
        <Card>
          <T v="label" className="mb-2">Default connection</T>
          <View className="flex-row flex-wrap gap-2">{PREFS.map(([k, l]) => <Chip key={k} label={l} selected={st.defaultConnection === k} onPress={() => st.set({ defaultConnection: k })} />)}</View>
          <Row title="Auto-reconnect" subtitle="Reconnect to the last receiver when it is found again" right={<Switch value={st.autoReconnect} onValueChange={(v) => st.set({ autoReconnect: v })} color={palette.brand} />} />
          <Row title="Keep screen on while presenting" right={<Switch value={st.keepScreenOn} onValueChange={(v) => st.set({ keepScreenOn: v })} color={palette.brand} />} />
        </Card>

        <SectionHeader title="Files & storage" />
        <Card>
          <Row icon={FileText} title="Storage used by SmartBeam" subtitle={used === null ? 'Unavailable' : formatBytes(used)} />
          <Row title="Delete imported copies after presenting" subtitle="Removes the managed copy when a presentation ends" right={<Switch value={st.autoDeleteImportedAfterPresenting} onValueChange={(v) => st.set({ autoDeleteImportedAfterPresenting: v })} color={palette.brand} />} />
          <Row icon={Trash2} title="Clear converted presentations" subtitle="Offline PDF copies made by the converter" onPress={() => confirm('Clear converted copies?', 'They will be converted again next time (needs the server).', async () => { const n = await clearConversions(); toast(`Freed ${formatBytes(n)}.`, 'success'); })} />
          <Row icon={Trash2} title="Clear thumbnail cache" onPress={() => confirm('Clear thumbnails?', 'They are re-created on demand.', async () => { const n = await Files.clearThumbnails(); toast(`Freed ${formatBytes(n)}.`, 'success'); })} />
          {trees.map((t) => <Row key={t.uri} icon={FolderX} title={`Revoke access: ${t.name}`} onPress={() => confirm('Revoke folder access?', 'SmartBeam will no longer be able to list this folder.', () => Files.releaseTree(t.uri))} />)}
          <Row icon={Trash2} tone="danger" title="Clear presentation history" onPress={() => confirm('Clear history?', 'Files are kept.', clearHistory)} />
        </Card>

        <SectionHeader title="Privacy & server" />
        <Card>
          <Row title="Remember presentation history" right={<Switch value={st.rememberHistory} onValueChange={(v) => st.set({ rememberHistory: v })} color={palette.brand} />} />
          <T v="label" className="mt-2">Optional SmartBeam server</T>
          <T v="caption" muted>Used only for PowerPoint conversion, Cast PDF hosting and QR rooms — and only after you approve each upload.</T>
          <TextInput value={st.backendUrl} onChangeText={(v) => st.set({ backendUrl: v.trim() })} placeholder="https://your-server.example.com" placeholderTextColor={c.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{ color: c.ink }} className={input} accessibilityLabel="Server address" />
          <TextInput value={st.backendKey} onChangeText={(v) => st.set({ backendKey: v.trim() })} placeholder="API key (if your server requires one)" placeholderTextColor={c.muted} autoCapitalize="none" secureTextEntry style={{ color: c.ink }} className={input} accessibilityLabel="Server API key" />
          {st.backendUrl && !/^https:\/\//.test(st.backendUrl) ? <T v="caption" className="text-warn mt-1">Use https:// — Android blocks plain HTTP and documents would be unencrypted.</T> : null}
          <Row icon={Shield} title="Privacy policy" onPress={() => setSheet('privacy')} />
          <Row icon={Info} title="Permission explanations" onPress={() => setSheet('permissions')} />
        </Card>

        <SectionHeader title="About" />
        <Card>
          <Row icon={HelpCircle} title="Help & troubleshooting" onPress={() => nav.navigate('Help')} />
          <Row icon={Info} title="About SmartBeam" subtitle={`Version ${pkg.version}`} onPress={() => setSheet('about')} />
        </Card>
      </ScrollView>

      <Sheet visible={sheet === 'privacy'} onClose={() => setSheet(null)} title="Privacy policy"><T>{PRIVACY_POLICY}</T></Sheet>
      <Sheet visible={sheet === 'permissions'} onClose={() => setSheet(null)} title="Why SmartBeam asks">
        {PERMISSION_EXPLANATIONS.map((p) => <View key={p.name} className="mb-3"><T v="label">{p.name}</T><T muted>{p.why}</T></View>)}
      </Sheet>
      <Sheet visible={sheet === 'about'} onClose={() => setSheet(null)} title="SmartBeam – Wireless Projector & Presentation">
        <T muted>Version {pkg.version}. Present PDF, PowerPoint, Word, images and video from your phone over Google Cast, external displays, QR rooms and guided Miracast. Features that need compatible hardware are labelled in the app; nothing is shown as connected unless it really is.</T>
      </Sheet>
    </SafeAreaView>
  );
}
