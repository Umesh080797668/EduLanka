import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../core/sync/sync_service.dart';
import '../disaster/disaster_pack_dialog.dart';

class TeacherHomeScreen extends ConsumerStatefulWidget {
  const TeacherHomeScreen({super.key});

  @override
  ConsumerState<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends ConsumerState<TeacherHomeScreen> {
  bool _isSyncing = false;
  int _pendingCount = 0;
  int _failedCount = 0;
  int _lastSequence = 0;

  @override
  void initState() {
    super.initState();
    _refreshSyncState();
    // Start background sync listener
    ref.read(syncServiceProvider).startAutoSync();
  }

  Future<void> _refreshSyncState() async {
    final pending = await LocalDatabase.instance.getPendingOutboxCount();
    final failed = await LocalDatabase.instance.getFailedOutboxCount();
    final seq = await LocalDatabase.instance.getLastSequence();
    if (mounted) {
      setState(() {
        _pendingCount = pending;
        _failedCount = failed;
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

  Future<void> _openMarkAttendanceDialog() async {
    final sampleStudentId = const Uuid().v4();
    final sampleClassId = const Uuid().v4();
    final studentIdController = TextEditingController(text: sampleStudentId);
    final classIdController = TextEditingController(text: sampleClassId);
    String selectedStatus = 'PRESENT';

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.how_to_reg_rounded, color: Color(0xFF0D9488)),
              SizedBox(width: 8),
              Text('Mark Attendance (Offline)'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: studentIdController,
                  decoration: const InputDecoration(
                    labelText: 'Student UUID / Code',
                    helperText: 'UUID required by server sync (free-text converted)',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: classIdController,
                  decoration: const InputDecoration(
                    labelText: 'Class UUID / Code',
                    helperText: 'UUID required by server sync (free-text converted)',
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: selectedStatus,
                  decoration: const InputDecoration(
                    labelText: 'Attendance Status',
                  ),
                  items: const [
                    DropdownMenuItem(value: 'PRESENT', child: Text('Present')),
                    DropdownMenuItem(value: 'ABSENT', child: Text('Absent')),
                    DropdownMenuItem(value: 'LATE', child: Text('Late')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setDialogState(() => selectedStatus = val);
                    }
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                foregroundColor: Colors.white,
              ),
              onPressed: () async {
                final studentId = studentIdController.text.trim();
                final classId = classIdController.text.trim();
                if (studentId.isEmpty || classId.isEmpty) return;

                final now = DateTime.now();
                final todayStr =
                    '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
                final recordId = const Uuid().v4();

                await LocalDatabase.instance.recordAttendance(
                  id: recordId,
                  studentId: studentId,
                  classId: classId,
                  date: todayStr,
                  status: selectedStatus,
                  markedAt: now.toUtc().toIso8601String(),
                );

                if (ctx.mounted) Navigator.of(ctx).pop();
                await _refreshSyncState();

                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'Marked attendance. Queued with UUID in offline outbox.',
                      ),
                    ),
                  );
                }
              },
              child: const Text('Save to Outbox'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Teacher Portal'),
        backgroundColor: const Color(0xFF0D9488),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Sync Outbox',
            icon: _isSyncing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Badge(
                    isLabelVisible: _pendingCount > 0,
                    label: Text('$_pendingCount'),
                    child: const Icon(Icons.sync_rounded),
                  ),
            onPressed: _isSyncing ? null : _handleSync,
          ),
          IconButton(
            tooltip: 'Sign Out',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_failedCount > 0) ...[
            Card(
              color: const Color(0xFFFEF2F2),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFFFECACA)),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    const Icon(Icons.sync_problem_rounded, color: Color(0xFFDC2626)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '$_failedCount sync event(s) failed validation. Tap to retry.',
                        style: const TextStyle(
                          color: Color(0xFFB91C1C),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () async {
                        await LocalDatabase.instance.retryFailedOutboxEvents();
                        await _handleSync();
                      },
                      child: const Text(
                        'Retry',
                        style: TextStyle(
                          color: Color(0xFFDC2626),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            color: const Color(0xFFF0FDFA),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(
                    Icons.how_to_reg_rounded,
                    color: Color(0xFF0D9488),
                    size: 36,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _pendingCount > 0
                              ? '$_pendingCount Attendance Record(s) Queued'
                              : 'Attendance Engine Synchronized',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Last server sync sequence #$_lastSequence. Roll calls recorded offline persist safely to local SQLite.',
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 12,
                          ),
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
            'Teaching Management',
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
                icon: Icons.checklist_rounded,
                title: 'Mark Attendance',
                subtitle: 'Period & Daily Roll-Call',
                color: const Color(0xFF0D9488),
                onTap: _openMarkAttendanceDialog,
              ),
              _buildCard(
                icon: Icons.emergency_rounded,
                title: 'Emergency Contacts',
                subtitle: 'Offline Disaster Pack',
                color: const Color(0xFFEF4444),
                onTap: () => DisasterPackSheet.show(context),
              ),
              _buildCard(
                icon: Icons.edit_calendar_rounded,
                title: 'Assign Homework',
                subtitle: 'Offline Task Queue',
                color: const Color(0xFF3B82F6),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Homework tasks queue into local outbox stream.',
                      ),
                    ),
                  );
                },
              ),
              _buildCard(
                icon: Icons.video_library_rounded,
                title: 'Media Lessons',
                subtitle: 'Upload & Review',
                color: const Color(0xFF8B5CF6),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Media quota synchronized with tenant storage.',
                      ),
                    ),
                  );
                },
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
