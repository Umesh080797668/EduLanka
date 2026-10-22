import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:edulanka_mobile/features/home/independent_learner_home.dart';
import 'package:edulanka_mobile/core/database/local_database.dart';

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({
      'edulanka_tutorial_seen_onboarding_tour': true,
      'edulanka_tutorial_seen_independent_learner_tour': true,
    });
  });

  testWidgets(
    'IndependentLearnerHomeScreen renders candidate dashboard elements',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.runAsync(() async {
        await LocalDatabase.instance.saveSyncMetadata(
          'cached_user_profile',
          jsonEncode({
            'independent_learner': {
              'candidate_level': 'A/L',
              'stream': 'Physical Science',
              'plan': 'INDIVIDUAL_PRO',
            },
            'active_grant': {
              'sponsor_name': 'Foundation Trust',
              'status': 'ACTIVE',
            },
          }),
        );
      });

      final container = ProviderContainer();
      addTearDown(() {
        container.dispose();
      });

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: IndependentLearnerHomeScreen(
              enableAutoSync: false,
              enableTutorialTour: false,
            ),
          ),
        ),
      );

      await tester.runAsync(() async {
        await Future.delayed(const Duration(milliseconds: 50));
      });
      await tester.pump();

      expect(find.text('Independent Learner Hub'), findsOneWidget);
      expect(find.text('Independent Candidate'), findsOneWidget);
      expect(find.text('Sponsored Grant Active'), findsOneWidget);
      expect(
        find.text('Track: G.C.E. A/L • Physical Science Stream'),
        findsOneWidget,
      );
      expect(find.text('National Syllabus & Past Papers'), findsOneWidget);
      expect(find.text('Candidate Learning Resources'), findsOneWidget);
      expect(find.text('Past Papers Hub'), findsOneWidget);
      expect(find.text('Offline Lessons'), findsOneWidget);
      expect(find.text('Academic Blogs'), findsOneWidget);
      expect(find.text('Disaster Readiness'), findsOneWidget);
      expect(find.text('Current Plan'), findsOneWidget);
      expect(find.text('Individual Pro'), findsOneWidget);
      expect(find.text('LKR 299/mo'), findsOneWidget);
      expect(find.text('20k tokens / mo'), findsOneWidget);
      expect(find.text('2 GB Encrypted'), findsOneWidget);
    },
  );
}
