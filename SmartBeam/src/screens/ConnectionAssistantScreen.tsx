import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { Button, Card, ProgressBar, Screen, StatusPill, T } from '../components/ui';
import { DeviceRow } from '../components/rows';
import { connectionManager } from '../connection';
import { System } from '../native';
import { getTestCardPath } from '../services/testCard';
import { useConnection } from '../store/connection';
import { connectDevice } from '../presentation/launch';
import { MIRACAST_STEPS } from '../connection/MiracastAdapter';
import { reportError, userMessage } from '../utils/errors';

const STEPS = ['Requirements', 'Wi-Fi', 'Cast receivers', 'Miracast', 'Methods', 'Connect', 'Confirm', 'Test output'];
type Check = { ok: boolean; text: string } | null;

export function ConnectionAssistantScreen() {
  const nav = useNavigation<any>();
  const [step, setStep] = useState(0);
  const [wifi, setWifi] = useState<Check>(null);
  const [found, setFound] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<'shown' | 'failed' | null>(null);
  const { devices, status, active, unsupported, error } = useConnection();

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  const checkWifi = async () => {
    setBusy(true);
    try { const n = await System.getNetworkState(); setWifi(n.lan ? { ok: true, text: `Connected via ${n.transport}.` } : { ok: false, text: n.transport === 'none' ? 'No network connection.' : `You are on ${n.transport}. Connect to the same Wi-Fi as the projector.` }); }
    catch (e) { setWifi({ ok: false, text: userMessage(e) }); }
    setBusy(false);
  };

  const discover = async () => {
    setBusy(true); setFound(null);
    await connectionManager.stopDiscovery();
    await connectionManager.startDiscovery(['google-cast', 'external-display', 'cloud-room']).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 6000));
    setFound(useConnection.getState().devices.filter((d) => d.adapterId !== 'miracast').length);
    setBusy(false);
  };

  const runTest = async () => {
    const adapter = connectionManager.current();
    if (!adapter || !active) return;
    setBusy(true);
    try {
      const path = await getTestCardPath();
      await adapter.present({ kind: 'image', path, mime: 'image/png', title: 'SmartBeam test card', fileId: 'test-card', page: 1, totalPages: 1 });
      setTestResult('shown');
    } catch (e) { setTestResult('failed'); reportError(e); }
    setBusy(false);
  };

  const Result = ({ c }: { c: Check }) => c ? (
    <View className="flex-row items-center gap-2 mt-3">{c.ok ? <CheckCircle2 size={20} color="#18A957" /> : <XCircle size={20} color="#E5484D" />}<T className="flex-1">{c.text}</T></View>
  ) : null;

  return (
    <Screen title="Connection assistant">
      <T v="caption" muted className="mt-1">Step {step + 1} of {STEPS.length}: {STEPS[step]}</T>
      <View className="my-2"><ProgressBar value={(step + 1) / STEPS.length} /></View>

      {step === 0 && <Card className="mt-3">
        <T v="h2">What you need</T>
        <T muted className="mt-2">• Google Cast: a Cast receiver and this phone on the same Wi-Fi.</T>
        <T muted>• External display: an HDMI / USB-C display connected to the phone.</T>
        <T muted>• Miracast: a Miracast projector and the phone's Smart View / Screen Cast.</T>
        <T muted>• QR room: any screen with a browser that opens your SmartBeam server.</T>
        <Button label="Start" className="mt-4" onPress={next} />
      </Card>}

      {step === 1 && <Card className="mt-3">
        <T v="h2">Check Wi-Fi</T><T muted className="mt-1">Cast needs the phone and the receiver on the same network.</T>
        <Result c={wifi} />
        <View className="flex-row gap-3 mt-4"><Button label="Check now" variant="secondary" className="flex-1" loading={busy} onPress={checkWifi} /><Button label="Next" className="flex-1" onPress={next} disabled={!wifi} /></View>
        {wifi && !wifi.ok ? <Button label="Troubleshoot Wi-Fi" variant="ghost" onPress={() => nav.navigate('Help', { topic: 'wifi' })} /> : null}
      </Card>}

      {step === 2 && <Card className="mt-3">
        <T v="h2">Discover receivers</T><T muted className="mt-1">Searching takes about 6 seconds.</T>
        {found !== null && <Result c={{ ok: found > 0, text: found > 0 ? `${found} receiver(s) found.` : 'No receivers found. The projector may be off, on another network, or not a Cast device.' }} />}
        <View className="flex-row gap-3 mt-4"><Button label="Search" variant="secondary" className="flex-1" loading={busy} onPress={discover} /><Button label="Next" className="flex-1" onPress={next} /></View>
        {found === 0 ? <Button label="Troubleshoot" variant="ghost" onPress={() => nav.navigate('Help', { topic: 'not-found' })} /> : null}
      </Card>}

      {step === 3 && <Card className="mt-3">
        <T v="h2">Miracast (optional)</T>
        {MIRACAST_STEPS.map((s, i) => <T key={i} muted className="mt-1">{i + 1}. {s}</T>)}
        <Button label="Open wireless display settings" variant="secondary" className="mt-3" onPress={() => System.openWirelessSettings().catch((e) => reportError(e))} />
        <Button label="Next" className="mt-2" onPress={next} />
      </Card>}

      {step === 4 && <Card className="mt-3">
        <T v="h2">Available methods</T>
        {connectionManager.list().map((a) => (
          <View key={a.id} className="mt-3"><View className="flex-row items-center gap-2"><T v="label" className="flex-1">{a.label}</T><StatusPill tone={unsupported[a.id] ? 'danger' : 'success'} label={unsupported[a.id] ? 'Unavailable' : a.programmaticConnect ? 'Ready' : 'Guided'} /></View>
            {unsupported[a.id] ? <T v="caption" muted>{unsupported[a.id]}</T> : null}</View>
        ))}
        <Button label="Next" className="mt-4" onPress={next} />
      </Card>}

      {step === 5 && <View className="mt-3">
        <T v="h2" className="mb-2">Choose a receiver</T>
        {devices.filter((d) => d.adapterId !== 'miracast').length
          ? devices.filter((d) => d.adapterId !== 'miracast').map((d) => <DeviceRow key={d.id} device={d} onPress={async () => { setBusy(true); const ok = await connectDevice(d); setBusy(false); if (ok) next(); }} />)
          : <T muted>No receivers available. Go back and search again.</T>}
        {status === 'connecting' ? <T muted>Connecting…</T> : null}
        {status === 'error' && error ? <T className="text-danger mt-2">{error}</T> : null}
        <Button label="Back to search" variant="ghost" onPress={() => setStep(2)} />
      </View>}

      {step === 6 && <Card className="mt-3">
        <T v="h2">Confirm connection</T>
        <Result c={status === 'connected' && active ? { ok: true, text: `Connected to ${active.name} via ${active.protocol}.` } : { ok: false, text: 'Not connected. SmartBeam only confirms a link the receiver has acknowledged.' }} />
        <View className="flex-row gap-3 mt-4"><Button label="Retry" variant="secondary" className="flex-1" onPress={() => setStep(5)} /><Button label="Next" className="flex-1" disabled={status !== 'connected'} onPress={next} /></View>
      </Card>}

      {step === 7 && <Card className="mt-3">
        <T v="h2">Test the output</T><T muted className="mt-1">A test card is sent to the display.</T>
        {testResult === 'shown' ? <T className="mt-3">Do you see the test card on the projector?</T> : null}
        {testResult === 'failed' ? <Result c={{ ok: false, text: 'The test card could not be displayed.' }} /> : null}
        <Button label={testResult ? 'Send again' : 'Show test card'} className="mt-4" loading={busy} disabled={status !== 'connected'} onPress={runTest} />
        {testResult === 'shown' ? <View className="flex-row gap-3 mt-3">
          <Button label="No" variant="secondary" className="flex-1" onPress={() => nav.navigate('Help', { topic: 'receiver-unavailable' })} />
          <Button label="Yes, done" className="flex-1" onPress={async () => { await connectionManager.current()?.stop(); nav.goBack(); }} />
        </View> : null}
      </Card>}
    </Screen>
  );
}
