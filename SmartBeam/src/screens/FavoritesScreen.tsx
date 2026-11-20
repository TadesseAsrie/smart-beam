import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Star } from 'lucide-react-native';
import { EmptyState, Screen } from '../components/ui';
import { FileRow } from '../components/rows';
import { openFile } from '../presentation/launch';
import { useLibrary } from '../store/library';

export function FavoritesScreen() {
  const nav = useNavigation<any>();
  const { files, toggleFavorite } = useLibrary();
  const favs = files.filter((f) => f.favorite);
  return (
    <Screen title="Favorites">
      {favs.length ? favs.map((f) => <FileRow key={f.id} file={f} onPress={() => openFile(f, nav)} onToggleFavorite={() => toggleFavorite(f.id)} />)
        : <EmptyState icon={Star} title="No favorites" message="Tap the star on any file to pin it here." />}
    </Screen>
  );
}
