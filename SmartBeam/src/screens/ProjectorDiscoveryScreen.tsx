import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Cable, Cast, HelpCircle, QrCode, Wifi, Wand2 } from 'lucide-react-native';
import { Button, Card, EmptyState, SectionHeader, StatusPill, T } from '../components/ui';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { DeviceRow } from '../components/rows';
import { connectionManager } from '../connection';
import { MIRACAST_STEPS } from '../connection/MiracastAdapter';
import { System } from '../native';
import { useConnection } from '../store/connection';
import { connectDevice } from '../presentation/launch';
import { reportError } from '../utils/errors';

export function ProjectorDiscoveryScreen() {
  const nav = useNavigation<any>();
  const { devices, status, unsupported, active } = useConnection();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    connectionManager.startDiscovery().catch((e) => reportError(e, { context: 'discovery' }));
    return () => { connectionManager.stopDiscovery(); };
  }, []));

  const refresh = async () => { setRefreshing(true); await connectionManager.stopDiscovery(); await connectionManager.startDiscovery().catch(() => undefined); setRefreshing(false); };
  const programmatic = devices.filter((d) => d.adapterId !== 'miracast');
  const miracast = devices.find((d) => d.adapterId === 'miracast');

  const onDevice = async (id: string) => {
    const d = devices.find((x) => x.id === id)!;
    if (d.state === 'connected') { nav.navigate('DeviceDetails', { deviceId: id }); return; }
    await connectDevice(d);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bgd" edges={['top']}>
      <ScrollView className="px-5" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentContainerStyle={{ paddingBottom: 32 }}>
        <T v="title" className="pt-4">Connect projector</T>
        <T muted>Discovering Google Cast receivers and external displays…</T>
        <Card className="mt-4"><ConnectionBanner />
          {status === 'connected' ? <Button label="Disconnect" variant="secondary" className="mt-3" onPress={() => connectionManager.disconnect()} /> : null}
        </Card>

        <View className="flex-row gap-3 mt-4">
          <Button label="Scan QR" icon={QrCode} variant="secondary" className="flex-1" onPress={() => nav.navigate('QrScanner')} />
          <Button label="Assistant" icon={Wand2} variant="secondary" className="flex-1" onPress={() => nav.navigate('ConnectionAssistant')} />
        </View>

        <SectionHeader title="Receivers" action="Details" onAction={() => nav.navigate('AvailableDevices')} />
        {programmatic.length ? programmatic.map((d) => <DeviceRow key={d.id} device={d} onPress={() => onDevice(d.id)} />)
          : <EmptyState icon={Cast} title={status === 'discovering' ? 'Searching…' : 'No receivers found'} message="Make sure the projector is on, in cast mode, and on the same Wi-Fi network as this phone." actionLabel="Troubleshoot" onAction={() => nav.navigate('Help', { topic: 'not-found' })} />}

        <SectionHeader title="Connection methods" />
        {(['google-cast', 'external-display', 'cloud-room', 'miracast'] as const).map((id) => {
          const a = connectionManager.get(id);
          if (!a) return null;
          const why = unsupported[id];
          const Icon = id === 'google-cast' ? Cast : id === 'external-display' ? Cable : id === 'cloud-room' ? QrCode : Wifi;
          return (
            <Card key={id} className="mb-2">
              <View className="flex-row items-center gap-2"><Icon size={18} color="#3867F5" /><T v="label" className="flex-1">{a.label}</T>
                <StatusPill tone={why ? 'danger' : 'success'} label={why ? 'Unavailable' : id === 'miracast' ? 'Guided' : 'Supported'} /></View>
              <T v="caption" muted className="mt-1">{why ?? a.requirement}</T>
            </Card>
          );
        })}

        <SectionHeader title="Miracast screen mirroring" />
        <Card>
          <T muted className="mb-2">Miracast is controlled by Android, not by apps. SmartBeam can open the system screen and cannot verify the link.</T>
          {miracast ? <T v="caption" muted className="mb-2">{miracast.description}</T> : null}
          {MIRACAST_STEPS.map((s, i) => <T key={i} v="caption" className="mb-1">{i + 1}. {s}</T>)}
          <Button label="Open wireless display settings" variant="secondary" className="mt-3" onPress={() => System.openWirelessSettings().catch((e) => reportError(e))} />
          {miracast ? <Button label="I've connected in Android settings" variant="ghost" className="mt-1" onPress={() => connectDevice(miracast)} /> : null}
        </Card>
        <Button label="Need help?" icon={HelpCircle} variant="ghost" className="mt-3" onPress={() => nav.navigate('Help')} />
      </ScrollView>
    </SafeAreaView>
  );
}
