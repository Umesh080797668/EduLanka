import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/sync/sync_service.dart';
import '../disaster/disaster_pack_dialog.dart';
import '../tutorial/tutorial_engine.dart';
import '../../l10n/app_localizations.dart';
import '../../core/localization/locale_provider.dart';

class AdminHomeScreen extends ConsumerStatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  ConsumerState<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends ConsumerState<AdminHomeScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _syncHealth;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    ref.read(syncServiceProvider).startAutoSync();
    _loadSyncHealth();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'phase3_disaster_pack');
    });
  }

  Future<void> _loadSyncHealth() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/mobile/sync-health');
      final data = res.data is Map && res.data.containsKey('data')
          ? res.data['data']
          : res.data;

      if (mounted) {
        setState(() {
          _syncHealth = data is Map ? Map<String, dynamic>.from(data) : null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _triggerDisasterPush() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Broadcast Emergency Alert'),
        content: const Text(
          'Activate Disaster Mode for the school? This will dispatch high-priority push notifications and prepare offline disaster packs on all registered student and teacher devices.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Broadcast Alert'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post(
        '/mobile/test-disaster-push',
        data: {
          'reason': 'EMERGENCY_WEATHER_CLOSURE',
          'expectedDuration': '3_DAYS',
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Emergency Disaster Alert broadcasted successfully.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        _loadSyncHealth();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to broadcast alert: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final role = authState.role ?? 'SCHOOL_ADMIN';
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Text(
          l10n?.dashboard ?? 'Administration Hub',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            tooltip: l10n?.refresh ?? 'Refresh Metrics',
            onPressed: _loadSyncHealth,
          ),
          const LanguageSelectorButton(),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            tooltip: l10n?.signOut ?? 'Sign Out',
            onPressed: () => showLogoutConfirmation(context, ref),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Admin Identity Header Card
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16.0),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1D4ED8).withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 28,
                    backgroundColor: Colors.white24,
                    child: Icon(Icons.shield, color: Colors.white, size: 32),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          role == 'SUPER_ADMIN'
                              ? 'System Super Administrator'
                              : 'School Principal & Administrator',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Tenant: ${authState.tenantId ?? "Institutional Domain"}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Sync Health Overview Card
            const Text(
              'Fleet Device Sync Health',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),

            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24.0),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.redAccent.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.redAccent),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Failed to load health metrics: $_errorMessage',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        _buildMetricTile(
                          icon: Icons.devices,
                          title: 'Active Devices',
                          value: '${_syncHealth?['totalActiveDevices'] ?? 0}',
                          color: const Color(0xFF38BDF8),
                        ),
                        const SizedBox(width: 12),
                        _buildMetricTile(
                          icon: Icons.sync,
                          title: 'Sync Sequence',
                          value: '#${_syncHealth?['latestSyncSequence'] ?? 0}',
                          color: const Color(0xFF34D399),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildMetricTile(
                          icon: Icons.cloud_off,
                          title: 'Unsynced Data',
                          value: '${_syncHealth?['unsyncedDevicesCount'] ?? 0}',
                          color: const Color(0xFFFBBF24),
                        ),
                        const SizedBox(width: 12),
                        _buildMetricTile(
                          icon: Icons.warning_amber,
                          title: 'Stale Devices',
                          value: '${_syncHealth?['staleDevicesCount'] ?? 0}',
                          color: const Color(0xFFF87171),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 24),

            // Emergency & Disaster Management Actions
            const Text(
              'Emergency Readiness & Controls',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),

            Card(
              color: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: Colors.white10),
              ),
              child: ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFFEF2F2),
                  child: Icon(Icons.campaign, color: Color(0xFFEF4444)),
                ),
                title: const Text(
                  'Broadcast Disaster Activation',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: const Text(
                  'Notify mobile devices and push offline disaster packs',
                  style: TextStyle(color: Colors.white60, fontSize: 12),
                ),
                trailing: const Icon(
                  Icons.chevron_right,
                  color: Colors.white38,
                ),
                onTap: _triggerDisasterPush,
              ),
            ),

            const SizedBox(height: 8),

            Card(
              color: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: Colors.white10),
              ),
              child: ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFECFDF5),
                  child: Icon(Icons.emergency_share, color: Color(0xFF10B981)),
                ),
                title: Text(
                  l10n?.disasterReadiness ?? 'View Disaster Pack Bundle',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: const Text(
                  'Inspect offline circulars, contacts, and shelters',
                  style: TextStyle(color: Colors.white60, fontSize: 12),
                ),
                trailing: const Icon(
                  Icons.chevron_right,
                  color: Colors.white38,
                ),
                onTap: () {
                  DisasterPackSheet.show(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricTile({
    required IconData icon,
    required String title,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white10),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
