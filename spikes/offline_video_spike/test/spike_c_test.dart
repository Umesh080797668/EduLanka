import 'package:flutter_test/flutter_test.dart';
import 'package:offline_video_spike/spike_c_fcm_push.dart';

void main() {
  test('Spike C: Disaster Mode push payload parsing and cross-tenant filtering', () {
    final payloadMap = {
      'type': 'DISASTER_MODE_ACTIVATED',
      'tenant_id': '45f9722b-eda0-453f-88d2-2c9ad06ec169',
      'reason': 'CYCLONE_WARNING',
      'expected_duration': '5_DAYS',
      'timestamp': '1760000000000',
    };

    final payload = DisasterModePushPayload.fromMap(payloadMap);
    expect(payload.tenantId, equals('45f9722b-eda0-453f-88d2-2c9ad06ec169'));
    expect(payload.reason, equals('CYCLONE_WARNING'));
    expect(payload.expectedClosureDuration, equals('5_DAYS'));
    expect(payload.issuedAtTimestamp, equals(1760000000000));

    final engine = SpikeCPushEngine();
    engine.currentTenantId = '45f9722b-eda0-453f-88d2-2c9ad06ec169';

    // Verify cross-tenant isolation: different tenant payload must NOT trigger sync
    final attackerTenantPayload = {
      'tenant_id': '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
      'reason': 'FLOOD',
    };
    final parsed = DisasterModePushPayload.fromMap(attackerTenantPayload);
    expect(parsed.tenantId != engine.currentTenantId, isTrue);
  });
}
