import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:offline_video_spike/spike_c_fcm_push.dart';

void main() {
  group('Spike C: Push Engine and Disaster Pack Sync Tests', () {
    test('Disaster Mode push payload parsing and attribute validation', () {
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
    });

    test('Cross-tenant push rejection: push from another school is dropped immediately', () async {
      final engine = SpikeCPushEngine();
      engine.currentTenantId = 'school-tenant-alpha';

      // Push payload belongs to a different school
      final crossTenantPush = {
        'type': 'DISASTER_MODE_ACTIVATED',
        'tenant_id': 'school-tenant-beta',
        'reason': 'FLOOD_WARNING',
        'expected_duration': '2_DAYS',
      };

      final handled = await engine.handlePushData(crossTenantPush);
      expect(handled, isFalse, reason: 'Cross-tenant push must be rejected');
      expect(engine.isDisasterModeCached, isFalse);
    });

    test('Disaster pack sync succeeds on HTTP 200 with valid payload', () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) {
        expect(request.uri.path, equals('/api/v1/mobile/disaster-pack'));
        request.response.statusCode = HttpStatus.ok;
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({
          'status': 'DISASTER_PACK_READY',
          'tenantId': 'school-tenant-alpha',
          'closure': {
            'reason': 'CYCLONE_WARNING',
            'expectedDuration': '3_DAYS',
          },
          'contacts': [
            {'name': 'Emergency Dispatch', 'phone': '119'},
          ],
          'notices': [
            {'id': 'notice-1', 'title': 'School Closed', 'content_html': '<p>Closed</p>'},
          ],
          'homework': [],
          'resources': [],
        }));
        request.response.close();
      });

      try {
        final engine = SpikeCPushEngine(
          apiBaseUrl: 'http://127.0.0.1:${server.port}',
          authToken: 'mock-jwt-token',
        );
        engine.currentTenantId = 'school-tenant-alpha';

        final success = await engine.checkAndSyncDisasterPack();
        expect(success, isTrue);
        expect(engine.isDisasterModeCached, isTrue);
      } finally {
        await server.close();
      }
    });

    test('Disaster pack sync fails safely on HTTP 500 error', () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) {
        request.response.statusCode = HttpStatus.internalServerError;
        request.response.write(jsonEncode({'message': 'Internal Server Error'}));
        request.response.close();
      });

      try {
        final engine = SpikeCPushEngine(
          apiBaseUrl: 'http://127.0.0.1:${server.port}',
        );
        engine.currentTenantId = 'school-tenant-alpha';

        final success = await engine.checkAndSyncDisasterPack();
        expect(success, isFalse);
        expect(engine.isDisasterModeCached, isFalse);
      } finally {
        await server.close();
      }
    });

    test('Disaster pack sync fails gracefully on network connection failure', () async {
      // Port 1 is not running any HTTP service; connection will fail
      final engine = SpikeCPushEngine(
        apiBaseUrl: 'http://127.0.0.1:1',
      );
      engine.currentTenantId = 'school-tenant-alpha';

      final success = await engine.checkAndSyncDisasterPack();
      expect(success, isFalse);
      expect(engine.isDisasterModeCached, isFalse);
    });

    test('Matching tenant push triggers automated disaster pack sync successfully', () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) {
        request.response.statusCode = HttpStatus.ok;
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({
          'status': 'DISASTER_PACK_READY',
          'tenantId': 'school-tenant-alpha',
          'contacts': [],
          'notices': [],
        }));
        request.response.close();
      });

      try {
        final engine = SpikeCPushEngine(
          apiBaseUrl: 'http://127.0.0.1:${server.port}',
        );
        engine.currentTenantId = 'school-tenant-alpha';

        final handled = await engine.handlePushData({
          'type': 'DISASTER_MODE_ACTIVATED',
          'tenant_id': 'school-tenant-alpha',
          'reason': 'FLOOD_WARNING',
          'expected_duration': '3_DAYS',
        });

        expect(handled, isTrue);
        expect(engine.isDisasterModeCached, isTrue);
      } finally {
        await server.close();
      }
    });
  });
}
