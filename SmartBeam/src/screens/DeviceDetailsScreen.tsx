import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button, Card, Chip, Screen, SectionHeader, StatusPill, T } from '../components/ui';
import { connectionManager } from '../connection';
import { useConnection } from '../store/connection';
import { useSettings } from '../store/settings';
import { connectDevice } from '../presentation/launch';
import type { Capability } from '../types';

const CAP_LABEL: Record<Capability, string> = { slides: 'Slides (PDF/PPT)', video: 'Video', image: 'Images', pointer: 'Laser pointer', blackout: 'Blackout', 'remote-control': 'Phone remote', 'system-mirror': 'System mirroring only' };

export function DeviceDetailsScreen() {
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const { devices, status, error, active } = useConnection();
  const removeRoom = useSettings((s) => s.removeRoom);
  const [busy, setBusy] = React.useState(false);
  const device = devices.find((d) => d.id === params.deviceId) ?? (active?.id === params.deviceId ? active : null);
  if (!device) return <Screen title="Device"><T muted>This device is no longer available.</T></Screen>;
  const adapter = connectionManager.get(device.adapterId);
  const connected = device.state === 'connected';
  return (
    <Screen title={device.name}>
      <Card className="mt-2">
        <StatusPill tone={connected ? 'success' : status === 'error' ? 'danger' : 'neutral'} label={connected ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Not connected'} />
        <T v="label" className="mt-3">Protocol</T><T muted>{device.protocol}</T>
        {device.model ? <><T v="label" className="mt-3">Model</T><T muted>{device.model}</T></> : null}
        {device.description ? <><T v="label" className="mt-3">Details</T><T muted>{device.description}</T></> : null}
        <T v="label" className="mt-3">Requirements</T><T muted>{adapter?.requirement}</T>
      </Card>
      <SectionHeader title="Capabilities" />
      <View className="flex-row flex-wrap gap-2">{device.capabilities.map((c) => <Chip key={c} label={CAP_LABEL[c]} selected />)}</View>
      {device.adapterId === 'google-cast' ? <T v="caption" muted className="mt-2">PDF and PowerPoint on Cast require the SmartBeam custom receiver. Video and images work with the default receiver.</T> : null}
      {error && status === 'error' ? <Card className="mt-4 border-danger"><T className="text-danger">{error}</T></Card> : null}
      <View className="mt-5 gap-3">
        {connected
          ? <Button label="Disconnect" variant="secondary" onPress={async () => { await connectionManager.disconnect(); }} />
          : <Button label={device.adapterId === 'miracast' ? 'Open settings & guide me' : 'Connect'} loading={busy || status === 'connecting'} onPress={async () => { setBusy(true); const ok = await connectDevice(device); setBusy(false); if (ok) nav.goBack(); }} />}
        {device.adapterId === 'cloud-room' ? <Button label="Forget this room" variant="danger" onPress={() => { removeRoom(device.meta!.roomId); nav.goBack(); }} /> : null}
        <Button label="Troubleshooting" variant="ghost" onPress={() => nav.navigate('Help')} />
      </View>
    </Screen>
  );
}
