import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocaleNotifier extends StateNotifier<Locale> {
  static const _prefKey = 'edulanka_user_locale';

  LocaleNotifier() : super(const Locale('en')) {
    _loadSavedLocale();
  }

  Future<void> _loadSavedLocale() async {
    final prefs = await SharedPreferences.getInstance();
    final savedCode = prefs.getString(_prefKey);
    if (savedCode != null &&
        (savedCode == 'si' || savedCode == 'ta' || savedCode == 'en')) {
      state = Locale(savedCode);
    }
  }

  Future<void> setLocale(Locale newLocale) async {
    if (state == newLocale) return;
    state = newLocale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, newLocale.languageCode);
  }
}

final localeProvider = StateNotifierProvider<LocaleNotifier, Locale>((ref) {
  return LocaleNotifier();
});

class LanguageSelectorButton extends ConsumerWidget {
  final Color? color;
  const LanguageSelectorButton({super.key, this.color});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentLocale = ref.watch(localeProvider);

    return PopupMenuButton<String>(
      icon: Icon(Icons.language_rounded, color: color ?? Colors.white),
      tooltip: 'Switch Language / භාෂාව / மொழி',
      onSelected: (code) {
        ref.read(localeProvider.notifier).setLocale(Locale(code));
      },
      itemBuilder: (ctx) => [
        PopupMenuItem(
          value: 'en',
          child: Row(
            children: [
              Text(
                'English',
                style: TextStyle(
                  fontWeight: currentLocale.languageCode == 'en'
                      ? FontWeight.bold
                      : FontWeight.normal,
                ),
              ),
              if (currentLocale.languageCode == 'en') const Spacer(),
              if (currentLocale.languageCode == 'en')
                const Icon(Icons.check, size: 16, color: Color(0xFF1E40AF)),
            ],
          ),
        ),
        PopupMenuItem(
          value: 'si',
          child: Row(
            children: [
              Text(
                'සිංහල (Sinhala)',
                style: TextStyle(
                  fontWeight: currentLocale.languageCode == 'si'
                      ? FontWeight.bold
                      : FontWeight.normal,
                ),
              ),
              if (currentLocale.languageCode == 'si') const Spacer(),
              if (currentLocale.languageCode == 'si')
                const Icon(Icons.check, size: 16, color: Color(0xFF1E40AF)),
            ],
          ),
        ),
        PopupMenuItem(
          value: 'ta',
          child: Row(
            children: [
              Text(
                'தமிழ் (Tamil)',
                style: TextStyle(
                  fontWeight: currentLocale.languageCode == 'ta'
                      ? FontWeight.bold
                      : FontWeight.normal,
                ),
              ),
              if (currentLocale.languageCode == 'ta') const Spacer(),
              if (currentLocale.languageCode == 'ta')
                const Icon(Icons.check, size: 16, color: Color(0xFF1E40AF)),
            ],
          ),
        ),
      ],
    );
  }
}
