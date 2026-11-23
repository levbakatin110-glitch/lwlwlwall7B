/**
 * iOS/Android оболочка Маи.
 * Грузит живой сайт https://hey-maya.ru (как Android TWA в Play).
 * Сборка IPA только на macOS + Xcode (см. docs/IOS_APP_STORE.md).
 */
const config = {
  appId: "ru.heymaya.app",
  appName: "Мая",
  webDir: "native-www",
  server: {
    url: "https://hey-maya.ru",
    cleartext: false,
    allowNavigation: [
      "hey-maya.ru",
      "*.hey-maya.ru",
      "yoomoney.ru",
      "*.yoomoney.ru",
      "yookassa.ru",
      "*.yookassa.ru",
    ],
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#f7f1ea",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#f7f1ea",
      showSpinner: false,
    },
  },
};

export default config;
