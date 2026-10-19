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
  /// **'No examination papers found for this filter.'**
  String get noPapersFound;

  /// No description provided for @offlineVideos.
  ///
  /// In en, this message translates to:
  /// **'Offline Library'**
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

  /// No description provided for @curriculumLessons.
  ///
  /// In en, this message translates to:
  /// **'Online Lessons'**
  String get curriculumLessons;

  /// No description provided for @schemePaired.
  ///
  /// In en, this message translates to:
  /// **'Scheme Paired'**
  String get schemePaired;

  /// No description provided for @paperOnly.
  ///
  /// In en, this message translates to:
  /// **'Paper Only'**
  String get paperOnly;

  /// No description provided for @view.
  ///
  /// In en, this message translates to:
  /// **'View'**
  String get view;

  /// No description provided for @play.
  ///
  /// In en, this message translates to:
  /// **'Play'**
  String get play;

  /// No description provided for @download.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get download;

  /// No description provided for @change.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get change;

  /// No description provided for @submitWork.
  ///
  /// In en, this message translates to:
  /// **'Submit Work'**
  String get submitWork;

  /// No description provided for @previous.
  ///
  /// In en, this message translates to:
  /// **'Previous'**
  String get previous;

  /// No description provided for @skip.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get skip;

  /// No description provided for @pending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get pending;

  /// No description provided for @planUpgradeRequired.
  ///
  /// In en, this message translates to:
  /// **'Plan Upgrade Required'**
  String get planUpgradeRequired;

  /// No description provided for @takeDown.
  ///
  /// In en, this message translates to:
  /// **'Take Down'**
  String get takeDown;

  /// No description provided for @restore.
  ///
  /// In en, this message translates to:
  /// **'Restore'**
  String get restore;

  /// No description provided for @submitReport.
  ///
  /// In en, this message translates to:
  /// **'Submit Report'**
  String get submitReport;

  /// No description provided for @reportSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Report submitted for review.'**
  String get reportSubmitted;

  /// No description provided for @articleTakenDown.
  ///
  /// In en, this message translates to:
  /// **'Article taken down and unpublished.'**
  String get articleTakenDown;

  /// No description provided for @articleRestored.
  ///
  /// In en, this message translates to:
  /// **'Article restored successfully.'**
  String get articleRestored;

  /// No description provided for @selectClassForClassBlog.
  ///
  /// In en, this message translates to:
  /// **'Please select a class for class-scoped blogs'**
  String get selectClassForClassBlog;

  /// No description provided for @blogPublished.
  ///
  /// In en, this message translates to:
  /// **'Educational blog published successfully!'**
  String get blogPublished;

  /// No description provided for @emergencyAlertSent.
  ///
  /// In en, this message translates to:
  /// **'Emergency Disaster Alert broadcasted successfully.'**
  String get emergencyAlertSent;

  /// No description provided for @videoUrlUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Video playback URL is not available'**
  String get videoUrlUnavailable;

  /// No description provided for @startingEncryptedDownload.
  ///
  /// In en, this message translates to:
  /// **'Starting encrypted download...'**
  String get startingEncryptedDownload;

  /// No description provided for @noVideoLessonsFound.
  ///
  /// In en, this message translates to:
  /// **'No video lessons found for this filter.'**
  String get noVideoLessonsFound;

  /// No description provided for @gradeSavedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Grade saved successfully.'**
  String get gradeSavedSuccessfully;

  /// No description provided for @paperDocumentUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Paper document URL is unavailable.'**
  String get paperDocumentUnavailable;

  /// No description provided for @paperDownloaded.
  ///
  /// In en, this message translates to:
  /// **'Paper & Marking Scheme downloaded for offline study!'**
  String get paperDownloaded;

  /// No description provided for @savedOffline.
  ///
  /// In en, this message translates to:
  /// **'Saved Offline'**
  String get savedOffline;

  /// No description provided for @allPapers.
  ///
  /// In en, this message translates to:
  /// **'All Papers'**
  String get allPapers;

  /// No description provided for @errorDownloadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to start download. Please try again.'**
  String get errorDownloadFailed;

  /// No description provided for @errorLoadingLessons.
  ///
  /// In en, this message translates to:
  /// **'Error loading lessons. Please try again.'**
  String get errorLoadingLessons;

  /// No description provided for @errorLoadingPapers.
  ///
  /// In en, this message translates to:
  /// **'Error loading papers. Please try again.'**
  String get errorLoadingPapers;

  /// No description provided for @errorActionFailed.
  ///
  /// In en, this message translates to:
  /// **'Action failed. Please try again.'**
  String get errorActionFailed;

  /// No description provided for @loadMore.
  ///
  /// In en, this message translates to:
  /// **'Load More'**
  String get loadMore;

  /// No description provided for @homeworkSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Homework submitted successfully!'**
  String get homeworkSubmitted;

  /// No description provided for @watch.
  ///
  /// In en, this message translates to:
  /// **'Watch'**
  String get watch;

  /// No description provided for @noOfflineLessons.
  ///
  /// In en, this message translates to:
  /// **'No Offline Lessons Downloaded'**
  String get noOfflineLessons;

  /// No description provided for @noOfflineLessonsDesc.
  ///
  /// In en, this message translates to:
  /// **'Download lessons from the Online tab for zero-data offline studying.'**
  String get noOfflineLessonsDesc;

  /// No description provided for @reportReasonPrompt.
  ///
  /// In en, this message translates to:
  /// **'Please provide a reason for flagging this article for academic review:'**
  String get reportReasonPrompt;

  /// No description provided for @alreadyReported.
  ///
  /// In en, this message translates to:
  /// **'You have already reported this blog post.'**
  String get alreadyReported;

  /// No description provided for @takedownReasonPrompt.
  ///
  /// In en, this message translates to:
  /// **'Specify administrative justification for unpublishing this article:'**
  String get takedownReasonPrompt;

  /// No description provided for @restoreArticleConfirm.
  ///
  /// In en, this message translates to:
  /// **'Restore this article and make it publicly readable again across the institution?'**
  String get restoreArticleConfirm;

  /// No description provided for @noCommentsYet.
  ///
  /// In en, this message translates to:
  /// **'No comments yet. Start the academic discourse!'**
  String get noCommentsYet;

  /// No description provided for @reply.
  ///
  /// In en, this message translates to:
  /// **'Reply'**
  String get reply;

  /// No description provided for @downloadQueued.
  ///
  /// In en, this message translates to:
  /// **'Download queued in background and will be available offline.'**
  String get downloadQueued;

  /// No description provided for @planUpgradeDesc.
  ///
  /// In en, this message translates to:
  /// **'Offline encrypted lesson downloads with local playback are exclusive to schools on the Growth and Institutional tiers (ADR-001).\n\nPlease contact your school administrator to upgrade.'**
  String get planUpgradeDesc;

  /// No description provided for @pinned.
  ///
  /// In en, this message translates to:
  /// **'Pinned'**
  String get pinned;

  /// No description provided for @pinAnswer.
  ///
  /// In en, this message translates to:
  /// **'Pin Insightful Answer'**
  String get pinAnswer;

  /// No description provided for @unpinAnswer.
  ///
  /// In en, this message translates to:
  /// **'Unpin Answer'**
  String get unpinAnswer;

  /// No description provided for @hideComment.
  ///
  /// In en, this message translates to:
  /// **'Hide Comment'**
  String get hideComment;

  /// No description provided for @academicDiscussions.
  ///
  /// In en, this message translates to:
  /// **'Academic Discussions'**
  String get academicDiscussions;
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
