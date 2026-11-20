import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = { Home: undefined; Files: undefined; Connect: undefined; History: undefined; Settings: undefined };

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  AvailableDevices: undefined;
  DeviceDetails: { deviceId: string };
  ConnectionAssistant: undefined;
  QrScanner: undefined;
  FileImport: undefined;
  PdfViewer: { fileId: string; startPage?: number; presenting?: boolean };
  PptViewer: { fileId: string; startPage?: number; presenting?: boolean };
  VideoPlayer: { fileId: string; presenting?: boolean; playlist?: string[] };
  PresentationController: undefined;
  PresenterView: undefined;
  Favorites: undefined;
  Help: { topic?: string } | undefined;
};
