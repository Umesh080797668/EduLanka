import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:edulanka_mobile/core/download/download_manager.dart';
import 'package:edulanka_mobile/features/tutorial/tutorial_engine.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 3 Mobile Infrastructure Tests', () {
    test('DownloadTask tracks progress calculation correctly', () {
      final task = DownloadTask(
        id: 'task-1',
        title: 'Science Lesson 1',
        remoteUrl: 'https://cdn.edulanka.lk/video.mp4',
        localPath: '/storage/video.mp4',
        receivedBytes: 5000,
        totalBytes: 10000,
      );

      expect(task.progress, 0.5);
      expect(task.isCompleted, false);
    });

    test(
      'TutorialEngine loads and records tour completion in SharedPreferences',
      () async {
        SharedPreferences.setMockInitialValues({});

        expect(await TutorialEngine.hasSeenTour('onboarding_tour'), false);
        await TutorialEngine.markTourSeen('onboarding_tour');
        expect(await TutorialEngine.hasSeenTour('onboarding_tour'), true);
      },
    );
  });
}
