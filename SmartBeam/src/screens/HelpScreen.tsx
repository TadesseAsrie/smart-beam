import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Button, Card, Screen, T } from '../components/ui';
import { TROUBLESHOOTING } from '../content/troubleshooting';
import { useColors } from '../theme/colors';

export function HelpScreen() {
  const nav = useNavigation<any>();
  const { params } = useRoute<any>();
  const c = useColors();
  const [open, setOpen] = useState<string | null>(params?.topic ?? null);
  return (
    <Screen title="Help & troubleshooting">
      <Button label="Run the connection assistant" className="mt-2" onPress={() => nav.navigate('ConnectionAssistant')} />
      <T v="h2" className="mt-6 mb-2">Common problems</T>
      {TROUBLESHOOTING.map((t) => (
        <Card key={t.id} className="mb-2" onPress={() => setOpen(open === t.id ? null : t.id)}>
          <View className="flex-row items-center"><T v="label" className="flex-1">{t.title}</T>{open === t.id ? <ChevronUp size={18} color={c.muted} /> : <ChevronDown size={18} color={c.muted} />}</View>
          {open === t.id ? (<View className="mt-3">
            <T v="caption" muted className="mb-1">Possible causes</T>{t.causes.map((x, i) => <T key={i} className="mb-1">• {x}</T>)}
            <T v="caption" muted className="mt-2 mb-1">What to try</T>{t.fixes.map((x, i) => <T key={i} className="mb-1">{i + 1}. {x}</T>)}
          </View>) : null}
        </Card>
      ))}
      <T v="h2" className="mt-6 mb-2">Which hardware do I need?</T>
      <Card>
        <T>• Google Cast: Chromecast, Google TV or Cast-enabled projector/TV on the same Wi-Fi. PDF/PowerPoint need the SmartBeam custom receiver.</T>
        <T className="mt-2">• External display: HDMI/USB-C adapter or a display Android registers as a presentation screen.</T>
        <T className="mt-2">• Miracast: connected in Android settings; SmartBeam cannot control or verify it.</T>
        <T className="mt-2">• QR room: any browser-capable screen that can reach your SmartBeam server.</T>
      </Card>
    </Screen>
  );
}
