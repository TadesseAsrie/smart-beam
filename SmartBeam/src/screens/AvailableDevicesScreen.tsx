import React, { useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Tv } from 'lucide-react-native';
import { Button, EmptyState, Screen, T } from '../components/ui';
import { DeviceRow } from '../components/rows';
import { connectionManager } from '../connection';
import { useConnection } from '../store/connection';
import { reportError } from '../utils/errors';

export function AvailableDevicesScreen() {
  const nav = useNavigation<any>();
  const devices = useConnection((s) => s.devices);
  useFocusEffect(useCallback(() => {
    connectionManager.startDiscovery().catch((e) => reportError(e));
    return () => { connectionManager.stopDiscovery(); };
  }, []));
  return (
    <Screen title="Available devices" right={<Button label="Refresh" small variant="ghost" onPress={async () => { await connectionManager.stopDiscovery(); connectionManager.startDiscovery(); }} />}>
      {devices.length ? <>{devices.map((d) => <DeviceRow key={d.id} device={d} onPress={() => nav.navigate('DeviceDetails', { deviceId: d.id })} />)}</>
        : <EmptyState icon={Tv} title="No devices yet" message="Receivers appear here as they are discovered." actionLabel="Troubleshoot" onAction={() => nav.navigate('Help', { topic: 'not-found' })} />}
      <T v="caption" muted className="mt-3">Only devices SmartBeam can really talk to are listed. Miracast links are made in Android settings.</T>
    </Screen>
  );
}
