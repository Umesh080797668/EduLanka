import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../core/sync/sync_service.dart';
import '../disaster/disaster_pack_dialog.dart';
import '../../l10n/app_localizations.dart';
import '../../core/localization/locale_provider.dart';

class ParentHomeScreen extends ConsumerStatefulWidget {
  const ParentHomeScreen({super.key});

  @override
  ConsumerState<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends ConsumerState<ParentHomeScreen> {
  bool _isSyncing = false;
  int _lastSequence = 0;

  @override
  void initState() {
    super.initState();
    ref.read(syncServiceProvider).startAutoSync();
    _refreshSyncState();
  }

  Future<void> _refreshSyncState() async {
    final seq = await LocalDatabase.instance.getLastSequence();
    if (mounted) {
      setState(() {
        _lastSequence = seq;
      });
    }
  }

  Future<void> _handleSync() async {
    setState(() {
      _isSyncing = true;
    });

    final result = await ref.read(syncServiceProvider).syncAll();
    await _refreshSyncState();

    if (mounted) {
      setState(() {
        _isSyncing = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message),
          backgroundColor: result.success
              ? const Color(0xFF10B981)
              : const Color(0xFFEF4444),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.dashboard ?? 'Parent Dashboard'),
        backgroundColor: const Color(0xFF6366F1),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Teacher Chat',
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            onPressed: () => context.push('/chat'),
          ),
          IconButton(
            tooltip: l10n?.syncChanges ?? 'Sync with School',
            icon: _isSyncing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.sync_rounded),
            onPressed: _isSyncing ? null : _handleSync,
          ),
          const LanguageSelectorButton(),
          IconButton(
            tooltip: l10n?.signOut ?? 'Sign Out',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => showLogoutConfirmation(context, ref),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            color: const Color(0xFFEEF2FF),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(
                    Icons.child_care_rounded,
                    color: Color(0xFF6366F1),
                    size: 36,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Student Monitoring',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Synchronized up to sequence #$_lastSequence. Child attendance & emergency notices cache for offline viewing.',
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 12,
                          ),
                        ),
                        if (authState.userId != null)
                          Text(
                            'Account: ${authState.userId}',
                            style: const TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 11,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          const Text(
            'Quick Actions',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.2,
            children: [
              _buildCard(
                icon: Icons.shield_rounded,
                title: l10n?.disasterReadiness ?? 'Disaster Alerts',
                subtitle: 'Offline Emergency Pack',
                color: const Color(0xFFEF4444),
                onTap: () => DisasterPackSheet.show(context),
              ),
              _buildCard(
                icon: Icons.calendar_month_rounded,
                title: l10n?.attendanceHistory ?? 'Attendance Report',
                subtitle: 'Daily Roll-Call Status',
                color: const Color(0xFF10B981),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        l10n?.attendanceHistory ??
                            'Viewing child attendance history...',
                      ),
                    ),
                  );
                },
              ),
              _buildCard(
                icon: Icons.assignment_turned_in_outlined,
                title: l10n?.homeworkTasks ?? 'Child Homework',
                subtitle: 'Track Tasks & Grades',
                color: const Color(0xFFF59E0B),
                onTap: () => context.push('/homework'),
              ),
              _buildCard(
                icon: Icons.chat_bubble_outline_rounded,
                title: 'Teacher Chat',
                subtitle: 'Direct Messaging',
                color: const Color(0xFF8B5CF6),
                onTap: () => context.push('/chat'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.15),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(height: 10),
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                subtitle,
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
