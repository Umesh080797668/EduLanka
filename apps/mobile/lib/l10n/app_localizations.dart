import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_si.dart';
import 'app_localizations_ta.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('si'),
    Locale('ta'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'EduLanka Mobile'**
  String get appTitle;

  /// No description provided for @appSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Offline-First School Learning Platform'**
  String get appSubtitle;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign In to EduLanka'**
  String get signIn;

  /// No description provided for @emailOrPhone.
  ///
  /// In en, this message translates to:
  /// **'Email, Phone, or ID'**
  String get emailOrPhone;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @schoolDomain.
  ///
  /// In en, this message translates to:
  /// **'School Domain / Tenant Slug'**
  String get schoolDomain;

  /// No description provided for @offlineMode.
  ///
  /// In en, this message translates to:
  /// **'Offline Mode Active'**
  String get offlineMode;

  /// No description provided for @offlineReady.
  ///
  /// In en, this message translates to:
  /// **'Offline Ready'**
  String get offlineReady;

  /// No description provided for @syncChanges.
  ///
  /// In en, this message translates to:
  /// **'Sync Changes'**
  String get syncChanges;

  /// No description provided for @allSynchronized.
  ///
  /// In en, this message translates to:
  /// **'All changes synchronized.'**
  String get allSynchronized;

  /// No description provided for @disasterReadiness.
  ///
  /// In en, this message translates to:
  /// **'Disaster Readiness Pack'**
  String get disasterReadiness;

  /// No description provided for @emergencyContacts.
  ///
  /// In en, this message translates to:
  /// **'Emergency Contacts'**
  String get emergencyContacts;

  /// No description provided for @evacuationShelters.
  ///
  /// In en, this message translates to:
  /// **'Evacuation Shelters'**
  String get evacuationShelters;

  /// No description provided for @markAttendance.
  ///
  /// In en, this message translates to:
  /// **'Mark Attendance'**
  String get markAttendance;

  /// No description provided for @pastPaperHub.
  ///
  /// In en, this message translates to:
  /// **'Past Paper Hub'**
  String get pastPaperHub;

  /// No description provided for @videoLessons.
  ///
  /// In en, this message translates to:
  /// **'Offline Video Lessons'**
  String get videoLessons;

  /// No description provided for @homeworkTasks.
  ///
  /// In en, this message translates to:
  /// **'Homework Tasks'**
  String get homeworkTasks;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign Out'**
  String get signOut;

  /// No description provided for @dashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// No description provided for @announcements.
  ///
  /// In en, this message translates to:
  /// **'Announcements'**
  String get announcements;

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @profileDetails.
  ///
  /// In en, this message translates to:
  /// **'Profile Details'**
  String get profileDetails;

  /// No description provided for @switchLanguage.
  ///
  /// In en, this message translates to:
  /// **'Switch Language'**
  String get switchLanguage;

  /// No description provided for @loginFailed.
  ///
  /// In en, this message translates to:
  /// **'Sign In Failed'**
  String get loginFailed;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'The email or password entered is incorrect.'**
  String get invalidCredentials;

  /// No description provided for @tenantNotFound.
  ///
  /// In en, this message translates to:
  /// **'School domain could not be resolved.'**
  String get tenantNotFound;

  /// No description provided for @loggingIn.
  ///
  /// In en, this message translates to:
  /// **'Signing in...'**
  String get loggingIn;

  /// No description provided for @welcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome Back'**
  String get welcomeBack;

  /// No description provided for @attendanceHistory.
  ///
  /// In en, this message translates to:
  /// **'Attendance History'**
  String get attendanceHistory;

  /// No description provided for @present.
  ///
  /// In en, this message translates to:
  /// **'Present'**
  String get present;

  /// No description provided for @absent.
  ///
  /// In en, this message translates to:
  /// **'Absent'**
  String get absent;

  /// No description provided for @late.
  ///
  /// In en, this message translates to:
  /// **'Late'**
  String get late;

  /// No description provided for @markPresent.
  ///
  /// In en, this message translates to:
  /// **'Mark Present'**
  String get markPresent;

  /// No description provided for @markAbsent.
  ///
  /// In en, this message translates to:
  /// **'Mark Absent'**
  String get markAbsent;

  /// No description provided for @attendanceRecorded.
  ///
  /// In en, this message translates to:
  /// **'Attendance recorded successfully.'**
  String get attendanceRecorded;

  /// No description provided for @offlineAttendanceQueued.
  ///
  /// In en, this message translates to:
  /// **'Offline attendance queued for synchronization.'**
  String get offlineAttendanceQueued;

  /// No description provided for @downloadPaper.
  ///
  /// In en, this message translates to:
  /// **'Download Past Paper'**
  String get downloadPaper;

  /// No description provided for @viewPaper.
  ///
  /// In en, this message translates to:
  /// **'View Document'**
  String get viewPaper;

  /// No description provided for @markingScheme.
  ///
  /// In en, this message translates to:
  /// **'Marking Scheme'**
  String get markingScheme;

  /// No description provided for @grade.
  ///
  /// In en, this message translates to:
  /// **'Grade'**
  String get grade;

  /// No description provided for @subject.
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get subject;

  /// No description provided for @year.
  ///
  /// In en, this message translates to:
  /// **'Year'**
  String get year;

  /// No description provided for @term.
  ///
  /// In en, this message translates to:
  /// **'Term'**
  String get term;

  /// No description provided for @downloadingPaper.
  ///
  /// In en, this message translates to:
  /// **'Downloading document...'**
  String get downloadingPaper;

  /// No description provided for @downloadCompleted.
  ///
  /// In en, this message translates to:
  /// **'Download completed.'**
  String get downloadCompleted;

  /// No description provided for @noPapersFound.
  ///
  /// In en, this message translates to:
  /// **'No past papers found for this selection.'**
  String get noPapersFound;

  /// No description provided for @offlineVideos.
  ///
  /// In en, this message translates to:
  /// **'Downloaded Video Lessons'**
  String get offlineVideos;

  /// No description provided for @downloadVideo.
  ///
  /// In en, this message translates to:
  /// **'Download Lesson for Offline'**
  String get downloadVideo;

  /// No description provided for @deleteVideo.
  ///
  /// In en, this message translates to:
  /// **'Remove Video'**
  String get deleteVideo;

  /// No description provided for @videoDuration.
  ///
  /// In en, this message translates to:
  /// **'Duration'**
  String get videoDuration;

  /// No description provided for @storageUsed.
  ///
  /// In en, this message translates to:
  /// **'Storage Used'**
  String get storageUsed;

  /// No description provided for @playbackError.
  ///
  /// In en, this message translates to:
  /// **'Unable to play video offline.'**
  String get playbackError;

  /// No description provided for @noVideosDownloaded.
  ///
  /// In en, this message translates to:
  /// **'No offline lessons downloaded yet.'**
  String get noVideosDownloaded;

  /// No description provided for @pendingHomework.
  ///
  /// In en, this message translates to:
  /// **'Pending Homework'**
  String get pendingHomework;

  /// No description provided for @submittedHomework.
  ///
  /// In en, this message translates to:
  /// **'Submitted Tasks'**
  String get submittedHomework;

  /// No description provided for @overdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get overdue;

  /// No description provided for @submitTask.
  ///
  /// In en, this message translates to:
  /// **'Submit Homework'**
  String get submitTask;

  /// No description provided for @submissionSuccess.
  ///
  /// In en, this message translates to:
  /// **'Homework submitted successfully.'**
  String get submissionSuccess;

  /// No description provided for @attachFile.
  ///
  /// In en, this message translates to:
  /// **'Attach File'**
  String get attachFile;

  /// No description provided for @dueDate.
  ///
  /// In en, this message translates to:
  /// **'Due Date'**
  String get dueDate;

  /// No description provided for @disasterAlertTitle.
  ///
  /// In en, this message translates to:
  /// **'Emergency Disaster Notice'**
  String get disasterAlertTitle;

  /// No description provided for @disasterClosureNotice.
  ///
  /// In en, this message translates to:
  /// **'School activities are temporarily suspended due to emergency.'**
  String get disasterClosureNotice;

  /// No description provided for @hotlineNumbers.
  ///
  /// In en, this message translates to:
  /// **'Emergency Hotlines'**
  String get hotlineNumbers;

  /// No description provided for @shelterDirections.
  ///
  /// In en, this message translates to:
  /// **'Shelter Directions & Map'**
  String get shelterDirections;

  /// No description provided for @shelterCapacity.
  ///
  /// In en, this message translates to:
  /// **'Shelter Capacity'**
  String get shelterCapacity;

  /// No description provided for @callEmergency.
  ///
  /// In en, this message translates to:
  /// **'Call Emergency Contact'**
  String get callEmergency;

  /// No description provided for @disasterPackSynced.
  ///
  /// In en, this message translates to:
  /// **'Emergency disaster pack is fully synced offline.'**
  String get disasterPackSynced;

  /// No description provided for @offlineAlert.
  ///
  /// In en, this message translates to:
  /// **'You are currently offline. Changes will automatically sync when online.'**
  String get offlineAlert;

  /// No description provided for @connecting.
  ///
  /// In en, this message translates to:
  /// **'Connecting to EduLanka...'**
  String get connecting;

  /// No description provided for @syncing.
  ///
  /// In en, this message translates to:
  /// **'Synchronizing data...'**
  String get syncing;

  /// No description provided for @syncFailed.
  ///
  /// In en, this message translates to:
  /// **'Synchronization could not be completed.'**
  String get syncFailed;

  /// No description provided for @syncCompleted.
  ///
  /// In en, this message translates to:
  /// **'Synchronization complete.'**
  String get syncCompleted;

  /// No description provided for @networkUnavailable.
  ///
  /// In en, this message translates to:
  /// **'No network connection available.'**
  String get networkUnavailable;

  /// No description provided for @ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @search.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get search;

  /// No description provided for @refresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get refresh;

  /// No description provided for @upgradeRequired.
  ///
  /// In en, this message translates to:
  /// **'Application Upgrade Required'**
  String get upgradeRequired;

  /// No description provided for @upgradeApp.
  ///
  /// In en, this message translates to:
  /// **'Please update EduLanka Mobile to continue.'**
  String get upgradeApp;

  /// No description provided for @academicBlogs.
  ///
  /// In en, this message translates to:
  /// **'Academic Blogs & Discourse'**
  String get academicBlogs;

  /// No description provided for @authorArticle.
  ///
  /// In en, this message translates to:
  /// **'Author Educational Article'**
  String get authorArticle;

  /// No description provided for @reportArticle.
  ///
  /// In en, this message translates to:
  /// **'Report Article'**
  String get reportArticle;

  /// No description provided for @takedownArticle.
  ///
  /// In en, this message translates to:
  /// **'Takedown Article'**
  String get takedownArticle;

  /// No description provided for @restoreArticle.
  ///
  /// In en, this message translates to:
  /// **'Restore Article'**
  String get restoreArticle;

  /// No description provided for @assignHomework.
  ///
  /// In en, this message translates to:
  /// **'Assign New Homework'**
  String get assignHomework;

  /// No description provided for @gradeSubmission.
  ///
  /// In en, this message translates to:
  /// **'Grade Submission'**
  String get gradeSubmission;

  /// No description provided for @publish.
  ///
  /// In en, this message translates to:
  /// **'Publish'**
  String get publish;

  /// No description provided for @submit.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get submit;

  /// No description provided for @browseFiles.
  ///
  /// In en, this message translates to:
  /// **'Browse Device Files'**
  String get browseFiles;

  /// No description provided for @pickSolutionFiles.
  ///
  /// In en, this message translates to:
  /// **'Pick Solution Files / Photos'**
  String get pickSolutionFiles;

  /// No description provided for @submissions.
  ///
  /// In en, this message translates to:
  /// **'Submissions'**
  String get submissions;

  /// No description provided for @noSubmissions.
  ///
  /// In en, this message translates to:
  /// **'No submissions received yet for this task.'**
  String get noSubmissions;

  /// No description provided for @broadcastEmergencyAlert.
  ///
  /// In en, this message translates to:
  /// **'Broadcast Emergency Alert'**
  String get broadcastEmergencyAlert;

  /// No description provided for @paperUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Question paper document unavailable or not downloaded.'**
  String get paperUnavailable;

  /// No description provided for @markingSchemeUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Official marking scheme unavailable or not downloaded.'**
  String get markingSchemeUnavailable;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'si', 'ta'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'si':
      return AppLocalizationsSi();
    case 'ta':
      return AppLocalizationsTa();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
