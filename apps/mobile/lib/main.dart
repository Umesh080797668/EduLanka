import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'l10n/app_localizations.dart';
import 'core/config/app_config.dart';
import 'core/navigation/app_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Firebase Background & Push Notification Initialization (ADR-003)
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Graceful fallback for local development or CI where google-services.json is absent
  }

  // 2. Sentry Crash Reporting Initialization (P3-S10)
  final config = AppConfig.fromEnvironment();
  if (config.sentryDsn != null && config.sentryDsn!.isNotEmpty) {
    await SentryFlutter.init(
      (options) {
        options.dsn = config.sentryDsn;
        options.tracesSampleRate = 1.0;
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
