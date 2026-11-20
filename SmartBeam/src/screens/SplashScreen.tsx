import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Projector } from 'lucide-react-native';
import { useLibrary } from '../store/library';
import { useSettings } from '../store/settings';
import { palette } from '../theme/colors';
import { T } from '../components/ui';

export function SplashScreen() {
  const nav = useNavigation<any>();
  const ready = useLibrary((s) => s.ready);
  const onboarded = useSettings((s) => s.onboarded);
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const minDone = useRef(false);
  const [min, setMin] = React.useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true })
    ]).start();
    const t = setTimeout(() => { minDone.current = true; setMin(true); }, 1300);
    return () => clearTimeout(t);
  }, [scale, opacity]);

  useEffect(() => {
    if (ready && min) nav.reset({ index: 0, routes: [{ name: onboarded ? 'Tabs' : 'Onboarding' }] });
  }, [ready, min, onboarded, nav]);

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: palette.navy }}>
      <Animated.View style={{ transform: [{ scale }], opacity }} className="items-center">
        <View className="h-28 w-28 rounded-[32px] items-center justify-center" style={{ backgroundColor: palette.brand }}>
          <Projector size={56} color="#fff" />
        </View>
        <T v="title" className="!text-white mt-6">SmartBeam</T>
        <T muted className="!text-cyan mt-1">Wireless Projector & Presentation</T>
      </Animated.View>
    </View>
  );
}
