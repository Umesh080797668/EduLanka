import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:video_player/video_player.dart';
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
  bool _manualAirplaneModeActive = false;
  final List<String> _logs = [];
  VideoPlayerController? _videoController;

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
    _videoController?.dispose();
    super.dispose();
  }

  Future<void> _runSpikeA() async {
    setState(() {
      _isRunningSpikeA = true;
      _logs.add('--- Running Spike A: Real Hardware Benchmark & AES-CTR Playback ---');
      _logs.add('Airplane mode confirmed by user: $_manualAirplaneModeActive');
    });

    try {
      final tempDir = (await getTemporaryDirectory()).path;
      final result = await SpikeATestRunner.runBenchmark(
        testDir: tempDir,
        manualAirplaneModeConfirmed: _manualAirplaneModeActive,
      );
      setState(() {
        _spikeAResult = result;
        _logs.add('Spike A Completed:');
        _logs.add('Device: ${result.deviceModel}');
        _logs.add('OS: ${result.osVersion}');
        _logs.add('Measured Memory: ${result.peakMemoryMb.toStringAsFixed(2)} MB');
        _logs.add('Measured Startup: ${result.startupLatencyMs} ms (Stopwatch)');
        _logs.add('Measured Seek: ${result.seekLatencyMs} ms (Stopwatch)');
        _logs.add('Airplane Mode Verified: ${result.airplaneModeVerified ? "YES" : "NO"}');
        _logs.add('Crypto Throughput: ${result.encryptionThroughputMBps.toStringAsFixed(1)} MB/s');
      });
    } catch (e) {
      setState(() {
        _logs.add('Spike A Failed: $e');
      });
    } finally {
      setState(() {
        _isRunningSpikeA = false;
      });
    }
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
            // Spike A Section
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
                      'Decodes encrypted MP4 via PointyCastle AES-CTR stream cipher with counter computed from byte offset (offset ~/ 16). Serves Range requests to video player without full-file decryption into memory.',
                      style: TextStyle(color: Colors.black54),
                    ),
                    const SizedBox(height: 12),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('I have toggled Airplane Mode ON (Cellular & Wi-Fi OFF)'),
                      value: _manualAirplaneModeActive,
                      onChanged: (val) {
                        setState(() {
                          _manualAirplaneModeActive = val ?? false;
                        });
                      },
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton.icon(
                      onPressed: _isRunningSpikeA ? null : _runSpikeA,
                      icon: _isRunningSpikeA
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.play_arrow),
                      label: Text(_isRunningSpikeA ? 'Measuring...' : 'Run Spike A Benchmark'),
                    ),
                    if (_spikeAResult != null) ...[
                      const Divider(height: 24),
                      _buildMetricRow('Device Model', _spikeAResult!.deviceModel),
                      _buildMetricRow('OS Version', _spikeAResult!.osVersion),
                      _buildMetricRow('Startup Latency', '${_spikeAResult!.startupLatencyMs} ms'),
                      _buildMetricRow('Seek Latency', '${_spikeAResult!.seekLatencyMs} ms'),
                      _buildMetricRow('Memory (RSS)', '${_spikeAResult!.peakMemoryMb.toStringAsFixed(1)} MB'),
                      _buildMetricRow('Throughput', '${_spikeAResult!.encryptionThroughputMBps.toStringAsFixed(1)} MB/s'),
                      _buildMetricRow('Airplane Mode', _spikeAResult!.airplaneModeVerified ? 'VERIFIED' : 'PENDING RADIOS OFF', isPass: _spikeAResult!.airplaneModeVerified),
                      _buildMetricRow('Source', _spikeAResult!.measurementSource),
                      const SizedBox(height: 8),
                      const Text(
                        'adb shell dumpsys meminfo command:\nadb shell dumpsys meminfo lk.edulanka.offline_video_spike',
                        style: TextStyle(fontSize: 11, fontFamily: 'monospace', color: Colors.blueGrey),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Spike C Section
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
                      'Tests high-priority data-only FCM push delivery, background isolate execution when app is swiped away, and Fallback Layer 4 upon relaunch.',
                      style: TextStyle(color: Colors.black54),
                    ),
                    const SizedBox(height: 12),
                    SelectableText(
                      'FCM Token: ${_pushEngine.currentDeviceToken ?? "Initializing / check console"}',
                      style: const TextStyle(fontSize: 12, fontFamily: 'monospace', color: Colors.deepPurple),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Pushes Received: ${_pushEngine.receivedPushes.length}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Diagnostic Logs
            const Text(
              'Diagnostic Execution Logs:',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              height: 200,
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
              color: isPass == true ? Colors.green.shade700 : (isPass == false ? Colors.red : Colors.black87),
            ),
          ),
        ],
      ),
    );
  }
}
