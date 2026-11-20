import React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Clock, Star } from 'lucide-react-native';
import { Button, EmptyState, T } from '../components/ui';
import { HistoryRow } from '../components/rows';
import { resumePresenting } from '../presentation/launch';
import { useLibrary } from '../store/library';
import { useSettings } from '../store/settings';

export function HistoryScreen() {
  const nav = useNavigation<any>();
  const { history, files, clearHistory, removeHistory } = useLibrary();
  const remember = useSettings((s) => s.rememberHistory);
  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bgd" edges={['top']}>
      <View className="px-5 pt-4 flex-row items-center">
        <T v="title" className="flex-1">History</T>
        <Button label="Favorites" icon={Star} variant="ghost" small onPress={() => nav.navigate('Favorites')} />
      </View>
      <ScrollView className="px-5 mt-3" contentContainerStyle={{ paddingBottom: 32 }}>
        {!remember ? <T muted className="mb-3">History recording is turned off in Settings.</T> : null}
        {history.length ? (<>
          {history.map((h) => (
            <View key={h.id}>
              <HistoryRow item={h} onPress={() => Alert.alert(h.fileName, `Last slide ${h.lastSlide} of ${h.totalSlides}.`, [
                { text: 'Resume', onPress: () => resumePresenting(h, files, nav) },
                { text: 'Remove from history', style: 'destructive', onPress: () => removeHistory(h.id) },
                { text: 'Cancel', style: 'cancel' }])} />
            </View>))}
          <Button label="Clear history" variant="ghost" className="mt-2" onPress={() => Alert.alert('Clear presentation history?', 'Your files are not deleted.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: clearHistory }])} />
        </>) : <EmptyState icon={Clock} title="No history yet" message="Presentations you give will be listed here so you can resume from the last slide." />}
      </ScrollView>
    </SafeAreaView>
  );
}
