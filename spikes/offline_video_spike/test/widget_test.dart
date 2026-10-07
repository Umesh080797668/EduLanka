import 'package:flutter_test/flutter_test.dart';
import 'package:offline_video_spike/main.dart';

void main() {
  testWidgets('Spike dashboard renders properly', (WidgetTester tester) async {
    await tester.pumpWidget(const SpikeDemoApp());
    expect(find.text('Phase 3 Sprint 0: Spikes A & C'), findsOneWidget);
    expect(find.text('Spike A: Chunked Encrypted MP4'), findsOneWidget);
    expect(find.text('Spike C: FCM Push & Fallback Verification'), findsOneWidget);
  });
}
