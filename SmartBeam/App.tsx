import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider, Snackbar } from 'react-native-paper';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { registerAdapters } from './src/connection';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initPresentationController } from './src/presentation/controller';
import { useLibrary } from './src/store/library';
import { useUi } from './src/store/ui';
import { palette, useColors } from './src/theme/colors';
import { reportError, installGlobalErrorHandler } from './src/utils/errors';
import { useApplyPreferences } from './src/hooks/useDisplayPrefs';

function Shell() {
  const c = useColors();
  const toast = useUi((s) => s.toast);
  const hide = useUi((s) => s.hide);
  useApplyPreferences();

  useEffect(() => {
    installGlobalErrorHandler();
    registerAdapters();
    initPresentationController();
    useLibrary.getState().load().catch((e) => reportError(e, { context: 'library' }));
  }, []);

  const navTheme = {
    ...(c.dark ? DarkTheme : DefaultTheme),
    colors: { ...(c.dark ? DarkTheme : DefaultTheme).colors, background: c.bg, card: c.surface, text: c.ink, border: c.line, primary: palette.brand }
  };
  const paperTheme = {
    ...(c.dark ? MD3DarkTheme : MD3LightTheme),
    colors: { ...(c.dark ? MD3DarkTheme : MD3LightTheme).colors, primary: palette.brand, secondary: palette.cyan, surface: c.surface, background: c.bg }
  };

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={c.dark ? 'light' : 'dark'} />
        <RootNavigator />
      </NavigationContainer>
      <Snackbar visible={!!toast} onDismiss={hide} duration={4500} action={{ label: 'OK', onPress: hide }} style={{ backgroundColor: toast?.tone === 'error' ? palette.danger : palette.navy }}>
        {toast?.message ?? ''}
      </Snackbar>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
