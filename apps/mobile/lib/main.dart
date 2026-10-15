import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'l10n/app_localizations.dart';
import 'core/config/app_config.dart';
import 'core/download/download_manager.dart';
import 'core/navigation/app_router.dart';
import 'core/notifications/push_notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = AppConfig.fromEnvironment();

  // 1. Syncfusion Licensing: Note that in Syncfusion Flutter v18.3.0+, runtime code
  // key registration was removed by Syncfusion; commercial compliance is account-managed.
  if (config.syncfusionLicenseKey != null &&
      config.syncfusionLicenseKey!.isNotEmpty) {
    debugPrint('Syncfusion enterprise license configured.');
  }

  // 2. Offline Downloads Expiry Purge & Resumption (P3-S6, ADR-001)
  try {
    await DownloadManager.instance.init();
  } catch (err) {
    debugPrint('DownloadManager initialization notice: $err');
  }

  // 3. Firebase Background & Push Notification Initialization (ADR-003)
  try {
    if (config.firebaseApiKey != null && config.firebaseApiKey!.isNotEmpty) {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: config.firebaseApiKey!,
          appId: config.firebaseAppId ?? '',
          messagingSenderId: config.firebaseMessagingSenderId ?? '',
          projectId: config.firebaseProjectId ?? '',
        ),
      );
    } else {
      await Firebase.initializeApp();
    }
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (err) {
    debugPrint('Firebase.initializeApp() notice: $err');
  }

  // 3. Sentry Crash Reporting Initialization (P3-S10) - tracesSampleRate tuned to 10%
  if (config.sentryDsn != null && config.sentryDsn!.isNotEmpty) {
    await SentryFlutter.init(
      (options) {
        options.dsn = config.sentryDsn;
        options.tracesSampleRate = 0.1;
      },
      appRunner: () => runApp(const ProviderScope(child: EduLankaMobileApp())),
    );
  } else {
    runApp(const ProviderScope(child: EduLankaMobileApp()));
  }
}

class EduLankaMobileApp extends ConsumerWidget {
  const EduLankaMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'EduLanka Mobile',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E40AF),
          primary: const Color(0xFF1E40AF),
          secondary: const Color(0xFF0D9488),
          surface: Colors.white,
        ),
        fontFamilyFallback: const [
          'NotoSansSinhala',
          'NotoSansTamil',
          'Inter',
          'sans-serif',
        ],
        cardTheme: const CardThemeData(elevation: 0.5, color: Colors.white),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF3B82F6),
          brightness: Brightness.dark,
        ),
        fontFamilyFallback: const [
          'NotoSansSinhala',
          'NotoSansTamil',
          'Inter',
          'sans-serif',
        ],
      ),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
