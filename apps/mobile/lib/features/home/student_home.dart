import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../core/sync/sync_service.dart';
import '../disaster/disaster_pack_dialog.dart';
import '../tutorial/tutorial_engine.dart';
import '../../l10n/app_localizations.dart';
import '../../core/localization/locale_provider.dart';

class StudentHomeScreen extends ConsumerStatefulWidget {
  const StudentHomeScreen({super.key});

  @override
  ConsumerState<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends ConsumerState<StudentHomeScreen> {
  bool _isSyncing = false;
  int _pendingCount = 0;
  int _lastSequence = 0;

  @override
  void initState() {
    super.initState();
    ref.read(syncServiceProvider).startAutoSync();
    _refreshSyncState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'onboarding_tour');
    });
  }

  Future<void> _refreshSyncState() async {
    final pending = await LocalDatabase.instance.getPendingOutboxCount();
    final seq = await LocalDatabase.instance.getLastSequence();
    if (mounted) {
      setState(() {
        _pendingCount = pending;
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
      TutorialEngine.showTourIfUnseen(context, 'phase3_sync_badge');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.dashboard ?? 'Student Learning Hub'),
        backgroundColor: const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: l10n?.announcements ?? 'School Notices',
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notices'),
          ),
          IconButton(
            tooltip: 'Chat',
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            onPressed: () => context.push('/chat'),
          ),
          IconButton(
            tooltip: 'App Tour & Help',
            icon: const Icon(Icons.help_outline_rounded),
            onPressed: () =>
                TutorialEngine.showTour(context, 'onboarding_tour'),
          ),
          IconButton(
            tooltip: l10n?.syncChanges ?? 'Sync Changes',
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
          // Offline Status Card
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            color: const Color(0xFFEFF6FF),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(
                    Icons.offline_pin_rounded,
                    color: Color(0xFF2563EB),
                    size: 36,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _pendingCount > 0
                              ? 'Offline Changes Queued'
                              : (l10n?.offlineReady ?? 'Offline Ready'),
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Synced up to sequence #$_lastSequence • Outbox queue: $_pendingCount pending',
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 12,
                          ),
                        ),
                        if (authState.userId != null)
                          Text(
                            'User ID: ${authState.userId}',
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

          Text(
            l10n?.appSubtitle ?? 'Curriculum & Practice',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          // Menu Items Grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.2,
            children: [
              _buildFeatureCard(
                icon: Icons.emergency_share_rounded,
                title: l10n?.disasterReadiness ?? 'Disaster Readiness',
                subtitle: 'Emergency Shelters & Contacts',
                color: const Color(0xFFEF4444),
                onTap: () => DisasterPackSheet.show(context),
              ),
              _buildFeatureCard(
                icon: Icons.notifications_active_rounded,
                title: l10n?.announcements ?? 'School Notices',
                subtitle: 'Circulars & Alerts',
                color: const Color(0xFF0284C7),
                onTap: () => context.push('/notices'),
              ),
              _buildFeatureCard(
                icon: Icons.assessment_rounded,
                title: 'Grades & Report Card',
                subtitle: 'Term Marks & PDF Report',
                color: const Color(0xFF4F46E5),
                onTap: () => context.push('/grades'),
              ),
              _buildFeatureCard(
                icon: Icons.video_collection_rounded,
                title: l10n?.videoLessons ?? 'Video Lessons',
                subtitle: 'Curriculum & Offline Library',
                color: const Color(0xFF3B82F6),
                onTap: () => context.push('/media'),
              ),
              _buildFeatureCard(
                icon: Icons.assignment_outlined,
                title: l10n?.pastPaperHub ?? 'Past Paper Hub',
                subtitle: 'Paired Marking Schemes',
                color: const Color(0xFF10B981),
                onTap: () => context.push('/papers'),
              ),
              _buildFeatureCard(
                icon: Icons.assignment_turned_in_outlined,
                title: l10n?.homeworkTasks ?? 'Homework Tasks',
                subtitle: 'Submit Offline',
                color: const Color(0xFFF59E0B),
                onTap: () => context.push('/homework'),
              ),
              _buildFeatureCard(
                icon: Icons.menu_book,
                title: l10n?.academicBlogs ?? 'Academic Blogs',
                subtitle:
                    l10n?.academicDiscussions ?? 'Class & School Discourse',
                color: const Color(0xFF8B5CF6),
                onTap: () => context.push('/blogs'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCard({
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
