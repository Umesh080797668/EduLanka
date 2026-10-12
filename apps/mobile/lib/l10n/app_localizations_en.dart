// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'EduLanka Mobile';

  @override
  String get appSubtitle => 'Offline-First School Learning Platform';

  @override
  String get signIn => 'Sign In to EduLanka';

  @override
  String get emailOrPhone => 'Email, Phone, or ID';

  @override
  String get password => 'Password';

  @override
  String get schoolDomain => 'School Domain / Tenant Slug';

  @override
  String get offlineMode => 'Offline Mode Active';

  @override
  String get offlineReady => 'Offline Ready';

  @override
  String get syncChanges => 'Sync Changes';

  @override
  String get allSynchronized => 'All changes synchronized.';

  @override
  String get disasterReadiness => 'Disaster Readiness Pack';

  @override
  String get emergencyContacts => 'Emergency Contacts';

  @override
  String get evacuationShelters => 'Evacuation Shelters';

  @override
  String get markAttendance => 'Mark Attendance';

  @override
  String get pastPaperHub => 'Past Paper Hub';

  @override
  String get videoLessons => 'Offline Video Lessons';

  @override
  String get homeworkTasks => 'Homework Tasks';

  @override
  String get signOut => 'Sign Out';
}
