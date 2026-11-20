import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Screen, T } from '../components/ui';
import { parseRoomQr, roomToDevice } from '../connection/CloudRoomAdapter';
import { connectDevice } from '../presentation/launch';
import { useSettings } from '../store/settings';

export function QrScannerScreen() {
  const nav = useNavigation<any>();
  const [perm, request] = useCameraPermissions();
  const addRoom = useSettings((s) => s.addRoom);
  const [msg, setMsg] = useState('Point the camera at the QR code on the receiver screen.');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const onScan = async (data: string) => {
    if (locked.current) return;
    const parsed = parseRoomQr(data);
    if (!parsed) { setMsg('That is not a SmartBeam receiver QR code.'); return; }
    locked.current = true; setBusy(true); setMsg('Pairing…');
    const room = { ...parsed, name: `Room ${parsed.id.slice(0, 4).toUpperCase()}` };
    addRoom(room);
    const ok = await connectDevice(roomToDevice(room));
    setBusy(false);
    if (ok) nav.goBack(); else { locked.current = false; setMsg('Could not connect. Make sure the receiver page is open, then scan again.'); }
  };

  if (!perm) return <Screen title="Scan QR code"><T muted>Checking camera permission…</T></Screen>;
  if (!perm.granted) return (
    <Screen title="Scan QR code">
      <T className="mt-4">SmartBeam uses the camera only to read the pairing QR code shown on a receiver screen. Nothing is recorded or stored.</T>
      <Button label="Allow camera" className="mt-4" onPress={request} />
      {!perm.canAskAgain ? <T v="caption" muted className="mt-2">Camera access was blocked. Enable it in Android Settings → Apps → SmartBeam → Permissions.</T> : null}
    </Screen>
  );
  return (
    <Screen title="Scan QR code" scroll={false} padded={false}>
      <View className="flex-1">
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : (r) => onScan(r.data)} />
        <View className="absolute bottom-0 left-0 right-0 bg-black/60 p-5"><T className="!text-white text-center">{msg}</T></View>
      </View>
    </Screen>
  );
}
