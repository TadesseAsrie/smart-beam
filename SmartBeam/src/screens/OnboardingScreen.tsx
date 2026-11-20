import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Cast, FileText, Smartphone } from 'lucide-react-native';
import { Button, T } from '../components/ui';
import { useSettings } from '../store/settings';
import { palette } from '../theme/colors';

const W = Dimensions.get('window').width;
const PAGES = [
  { icon: FileText, title: 'Present from your phone', text: 'Open PDF, PowerPoint, Word, images and video straight from your phone. No laptop required.' },
  { icon: Cast, title: 'Connect honestly', text: 'Google Cast, HDMI/USB-C displays, QR rooms and guided Miracast. SmartBeam only says "connected" when the link is real.' },
  { icon: Smartphone, title: 'Your phone is the remote', text: 'Next, previous, laser pointer, blackout, notes and timer — while the audience sees only the slides.' }
];

export function OnboardingScreen() {
  const nav = useNavigation<any>();
  const set = useSettings((s) => s.set);
  const [i, setI] = useState(0);
  const ref = useRef<FlatList>(null);
  const finish = () => { set({ onboarded: true }); nav.reset({ index: 0, routes: [{ name: 'Tabs' }] }); };
  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bgd">
      <View className="flex-row justify-end px-5 h-12 items-center"><Button label="Skip" variant="ghost" small onPress={finish} /></View>
      <FlatList
        ref={ref} data={PAGES} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(p) => p.title}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item }) => (
          <View style={{ width: W }} className="items-center justify-center px-10">
            <View className="h-32 w-32 rounded-[40px] items-center justify-center mb-8" style={{ backgroundColor: palette.brand + '22' }}>
              <item.icon size={60} color={palette.brand} />
            </View>
            <T v="title" className="text-center">{item.title}</T>
            <T muted className="text-center mt-3">{item.text}</T>
          </View>
        )}
      />
      <View className="flex-row justify-center gap-2 mb-4">
        {PAGES.map((_, k) => <View key={k} className={`h-2 rounded-full ${k === i ? 'w-6 bg-brand' : 'w-2 bg-line dark:bg-lined'}`} />)}
      </View>
      <View className="px-5 pb-6">
        <Button label={i === PAGES.length - 1 ? 'Get started' : 'Next'} onPress={() => (i === PAGES.length - 1 ? finish() : ref.current?.scrollToIndex({ index: i + 1 }))} />
      </View>
    </SafeAreaView>
  );
}
