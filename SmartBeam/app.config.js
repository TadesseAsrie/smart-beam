// Dynamic Expo config. Set SMARTBEAM_CAST_APP_ID to your registered Cast receiver App ID.
module.exports = {
  expo: {
    name: "SmartBeam",
    slug: "smartbeam",
    version: "1.0.0",
    orientation: "default",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#101B36",
    },
    android: {
      package: "com.smartbeam.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#101B36",
      },
      // Scoped storage only: no broad storage permissions are requested.
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.RECORD_AUDIO",
      ],
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission:
            "SmartBeam uses the camera only to scan a QR code that pairs a receiver screen.",
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 37,
            targetSdkVersion: 36,
            buildToolsVersion: "37.0.0",
            minSdkVersion: 24,
          },
        },
      ],
      [
        "./plugins/withSmartBeam",
        { castAppId: process.env.SMARTBEAM_CAST_APP_ID || "CC1AD845" },
      ],
    ],
    extra: {
      defaultBackendUrl: process.env.SMARTBEAM_BACKEND_URL || "",
      eas: {
        projectId: "d0d31f9b-8865-47ff-a6af-0c4eb8a6fe6e",
      },
    },
  },
};
