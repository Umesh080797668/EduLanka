import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'spike_a_chunked_video.dart';
import 'spike_c_fcm_push.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SpikeDemoApp());
}

class SpikeDemoApp extends StatelessWidget {
  const SpikeDemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EduLanka Phase 3 Sprint 0 Spikes',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const SpikeDashboardScreen(),
    );
  }
}

class SpikeDashboardScreen extends StatefulWidget {
  const SpikeDashboardScreen({super.key});

  @override
  State<SpikeDashboardScreen> createState() => _SpikeDashboardScreenState();
}

class _SpikeDashboardScreenState extends State<SpikeDashboardScreen> {
  final SpikeCPushEngine _pushEngine = SpikeCPushEngine();
  SpikeABenchmarkResult? _spikeAResult;
  bool _isRunningSpikeA = false;
  final List<String> _logs = [];

  @override
  void initState() {
    super.initState();
    _pushEngine.initialize(
      userId: '1559a7f0-1fe3-4038-914a-6ea03ca31bab',
      tenantId: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    );
    _pushEngine.logs.listen((log) {
      if (mounted) {
        setState(() {
          _logs.add(log);
        });
      }
    });
  }

  @override
  void dispose() {
    _pushEngine.dispose();
    super.dispose();
  }

  Future<void> _runSpikeA() async {
    setState(() {
      _isRunningSpikeA = true;
      _logs.add('--- Starting Spike A: Chunked Video Encryption & Seek Benchmark ---');
    });

    try {
      final tempDir = (await getTemporaryDirectory()).path;
      final result = await SpikeATestRunner.runBenchmark(testDir: tempDir);
      setState(() {
        _spikeAResult = result;
        _logs.add('Spike A Complete: Device=${result.deviceModel}');
        _logs.add('Peak RAM=${result.peakMemoryMb}MB | Startup=${result.startupLatencyMs}ms | Seek=${result.seekLatencyMs}ms');
        _logs.add('Resumable Download: ${result.resumableDownloadSuccess ? "PASSED" : "FAILED"}');
        _logs.add('Airplane Mode Playback: ${result.airplaneModePlaybackSuccess ? "PASSED" : "FAILED"}');
      });
    } catch (e) {
      setState(() {
        _logs.add('Spike A Failed with error: $e');
      });
    } finally {
      setState(() {
        _isRunningSpikeA = false;
      });
    }
  }

  Future<void> _testUserSwitch() async {
    _logs.add('Simulating family phone user switch (Sibling Login)...');
    await _pushEngine.registerDeviceToken(
      fcmToken: 'fcm_token_sibling_test_abc123',
      platform: 'android',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Phase 3 Sprint 0: Spikes A & C'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Spike A: Chunked Encrypted MP4',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Tests resumable download, 64KB chunked AES-CTR encryption, seeking without in-memory full decrypt on 2GB RAM device, and airplane mode playback.',
                      style: TextStyle(color: Colors.black54),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: _isRunningSpikeA ? null : _runSpikeA,
                      icon: _isRunningSpikeA
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.play_arrow),
                      label: Text(_isRunningSpikeA ? 'Running Benchmark...' : 'Run Spike A Benchmark'),
                    ),
                    if (_spikeAResult != null) ...[
                      const Divider(height: 24),
                      _buildMetricRow('Target Hardware', _spikeAResult!.deviceModel),
                      _buildMetricRow('RAM & OS', '${_spikeAResult!.ramGb} GB RAM · ${_spikeAResult!.osVersion}'),
                      _buildMetricRow('Throughput', '${_spikeAResult!.encryptionThroughputMBps.toStringAsFixed(1)} MB/s'),
                      _buildMetricRow('Startup Latency', '${_spikeAResult!.startupLatencyMs} ms'),
                      _buildMetricRow('Random Seek Latency', '${_spikeAResult!.seekLatencyMs} ms'),
                      _buildMetricRow('Peak Memory', '${_spikeAResult!.peakMemoryMb} MB (≤ 128KB buffer)'),
                      _buildMetricRow('Resumable Download', _spikeAResult!.resumableDownloadSuccess ? 'VERIFIED' : 'FAILED', isPass: true),
                      _buildMetricRow('Airplane Mode', _spikeAResult!.airplaneModePlaybackSuccess ? 'OPERATIONAL' : 'FAILED', isPass: true),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Spike C: FCM Push & Fallback Verification',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Tests multi-channel disaster pack fallback, token ownership re-assignment on shared phones, and terminated app state resilience.',
                      style: TextStyle(color: Colors.black54),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: _testUserSwitch,
                      icon: const Icon(Icons.switch_account),
                      label: const Text('Simulate Shared Phone Token Reassignment'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Diagnostic Execution Logs:',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              height: 180,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(8),
              ),
              child: ListView.builder(
                itemCount: _logs.length,
                itemBuilder: (context, index) {
                  return Text(
                    _logs[index],
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      color: Colors.greenAccent,
                      fontSize: 11,
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricRow(String label, String value, {bool? isPass}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Colors.black87)),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: isPass == true ? Colors.green.shade700 : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }
}
