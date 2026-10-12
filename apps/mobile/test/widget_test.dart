import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:edulanka_mobile/main.dart';

void main() {
  testWidgets('EduLankaMobileApp renders login screen smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: EduLankaMobileApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('EduLanka Mobile'), findsOneWidget);
    expect(find.text('Sign In to EduLanka'), findsOneWidget);
  });
}
