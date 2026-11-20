import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Cast, Clock, FolderOpen, Home, Settings as SettingsIcon } from 'lucide-react-native';
import { useColors } from '../theme/colors';
import type { RootStackParamList, TabParamList } from './types';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FileManagerScreen } from '../screens/FileManagerScreen';
import { ProjectorDiscoveryScreen } from '../screens/ProjectorDiscoveryScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AvailableDevicesScreen } from '../screens/AvailableDevicesScreen';
import { DeviceDetailsScreen } from '../screens/DeviceDetailsScreen';
import { ConnectionAssistantScreen } from '../screens/ConnectionAssistantScreen';
import { QrScannerScreen } from '../screens/QrScannerScreen';
import { FileImportScreen } from '../screens/FileImportScreen';
import { PdfViewerScreen, PptViewerScreen } from '../screens/DocumentViewerScreens';
import { VideoPlayerScreen } from '../screens/VideoPlayerScreen';
import { PresentationControllerScreen } from '../screens/PresentationControllerScreen';
import { PresenterViewScreen } from '../screens/PresenterViewScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { HelpScreen } from '../screens/HelpScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  const c = useColors();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' }
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tab.Screen name="Files" component={FileManagerScreen} options={{ tabBarIcon: ({ color, size }) => <FolderOpen color={color} size={size} /> }} />
      <Tab.Screen name="Connect" component={ProjectorDiscoveryScreen} options={{ tabBarIcon: ({ color, size }) => <Cast color={color} size={size} /> }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarIcon: ({ color, size }) => <Clock color={color} size={size} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Tabs" component={Tabs} options={{ animation: 'fade' }} />
      <Stack.Screen name="AvailableDevices" component={AvailableDevicesScreen} />
      <Stack.Screen name="DeviceDetails" component={DeviceDetailsScreen} />
      <Stack.Screen name="ConnectionAssistant" component={ConnectionAssistantScreen} />
      <Stack.Screen name="QrScanner" component={QrScannerScreen} />
      <Stack.Screen name="FileImport" component={FileImportScreen} />
      <Stack.Screen name="PdfViewer" component={PdfViewerScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="PptViewer" component={PptViewerScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="PresentationController" component={PresentationControllerScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="PresenterView" component={PresenterViewScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
    </Stack.Navigator>
  );
}
