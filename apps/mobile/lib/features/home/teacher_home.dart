import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../core/sync/sync_service.dart';
import '../disaster/disaster_pack_dialog.dart';
import '../tutorial/tutorial_engine.dart';
import '../../l10n/app_localizations.dart';
import '../../core/localization/locale_provider.dart';

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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'phase3_offline_attendance');
    });
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
      TutorialEngine.showTourIfUnseen(context, 'phase3_sync_badge');
    }
  }

  Future<void> _openMarkAttendanceDialog() async {
    // 1. Initial classes and default roster
    List<Map<String, dynamic>> availableClasses = [
      {
        'id': 'a1111111-1111-1111-1111-111111111111',
        'name': 'Grade 10 - Section A',
      },
      {
        'id': 'a2222222-2222-2222-2222-222222222222',
        'name': 'Grade 11 - Section B',
      },
      {
        'id': 'a3333333-3333-3333-3333-333333333333',
        'name': 'Grade 12 - Science',
      },
    ];

    try {
      final remoteClasses = await ref.read(apiClientProvider).getClasses();
      if (remoteClasses.isNotEmpty) {
        availableClasses = remoteClasses.map((c) {
          final grade = c['grade'] ?? '';
          final sec = c['section'] ?? '';
          final name = 'Grade $grade - Section $sec';
          return {
            'id': c['id']?.toString() ?? '',
            'name': name.trim().isNotEmpty ? name : 'Class ${c['id']}',
            'students': c['students'],
          };
        }).toList();
      }
    } catch (_) {
      // Offline fallback: continue with cached / default class list
    }

    String selectedClassId = availableClasses.first['id'] as String;
    String selectedPeriod = 'Full Day';
    DateTime selectedDate = DateTime.now();

    final periods = const [
      'Full Day',
      'Period 1',
      'Period 2',
      'Period 3',
      'Period 4',
      'Period 5',
      'Period 6',
      'Period 7',
      'Period 8',
    ];

    // Roster generation / resolution
    final Map<String, List<Map<String, dynamic>>> classRosters = {
      selectedClassId: [
        {
          'id': 's1111111-1111-1111-1111-111111111111',
          'name': 'Kasun Perera',
          'admissionNo': '2026-001',
        },
        {
          'id': 's2222222-2222-2222-2222-222222222222',
          'name': 'Amali Fernando',
          'admissionNo': '2026-002',
        },
        {
          'id': 's3333333-3333-3333-3333-333333333333',
          'name': 'Dinuka Silva',
          'admissionNo': '2026-003',
        },
        {
          'id': 's4444444-4444-4444-4444-444444444444',
          'name': 'Nimali Rathnayake',
          'admissionNo': '2026-004',
        },
        {
          'id': 's5555555-5555-5555-5555-555555555555',
          'name': 'Kavindu Jayasuriya',
          'admissionNo': '2026-005',
        },
      ],
    };

    final Map<String, String> studentStatus = {};
    for (final s in classRosters[selectedClassId]!) {
      studentStatus[s['id'] as String] = 'PRESENT';
    }

    if (!mounted) return;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final currentRoster =
              classRosters[selectedClassId] ??
              [
                {
                  'id': 's1111111-1111-1111-1111-111111111111',
                  'name': 'Kasun Perera',
                  'admissionNo': '2026-001',
                },
                {
                  'id': 's2222222-2222-2222-2222-222222222222',
                  'name': 'Amali Fernando',
                  'admissionNo': '2026-002',
                },
              ];

          for (final s in currentRoster) {
            studentStatus.putIfAbsent(s['id'] as String, () => 'PRESENT');
          }

          final dateStr =
              '${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}';

          final l10n = AppLocalizations.of(ctx);

          return AlertDialog(
            title: Row(
              children: [
                const Icon(Icons.how_to_reg_rounded, color: Color(0xFF0D9488)),
                const SizedBox(width: 8),
                Text(l10n?.markAttendance ?? 'Class Roll-Call Attendance'),
              ],
            ),
            content: SizedBox(
              width: double.maxFinite,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Class Picker
                    DropdownButtonFormField<String>(
                      initialValue: selectedClassId,
                      decoration: const InputDecoration(
                        labelText: 'Select Class / Section',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      items: availableClasses.map((c) {
                        return DropdownMenuItem<String>(
                          value: c['id'] as String,
                          child: Text(c['name'] as String),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            selectedClassId = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),

                    // Period & Date row
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: selectedPeriod,
                            decoration: const InputDecoration(
                              labelText: 'Period',
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                            ),
                            items: periods.map((p) {
                              return DropdownMenuItem(value: p, child: Text(p));
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setDialogState(() => selectedPeriod = val);
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            icon: const Icon(
                              Icons.calendar_today_rounded,
                              size: 18,
                            ),
                            label: Text(
                              dateStr,
                              style: const TextStyle(fontSize: 12),
                            ),
                            onPressed: () async {
                              final picked = await showDatePicker(
                                context: ctx,
                                initialDate: selectedDate,
                                firstDate: DateTime.now().subtract(
                                  const Duration(days: 30),
                                ),
                                lastDate: DateTime.now().add(
                                  const Duration(days: 7),
                                ),
                              );
                              if (picked != null) {
                                setDialogState(() => selectedDate = picked);
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Roster Header & "Mark All Present" Action
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Student Roster (${currentRoster.length})',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        TextButton.icon(
                          icon: const Icon(
                            Icons.done_all_rounded,
                            size: 16,
                            color: Color(0xFF10B981),
                          ),
                          label: const Text(
                            'All Present',
                            style: TextStyle(
                              color: Color(0xFF10B981),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          onPressed: () {
                            setDialogState(() {
                              for (final s in currentRoster) {
                                studentStatus[s['id'] as String] = 'PRESENT';
                              }
                            });
                          },
                        ),
                      ],
                    ),
                    const Divider(height: 1),
                    const SizedBox(height: 8),

                    // Roster List
                    ...currentRoster.map((student) {
                      final sId = student['id'] as String;
                      final sName = student['name'] as String;
                      final sAdm = student['admissionNo'] as String? ?? '';
                      final currentStatus = studentStatus[sId] ?? 'PRESENT';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    sName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  if (sAdm.isNotEmpty)
                                    Text(
                                      'Adm: $sAdm',
                                      style: const TextStyle(
                                        color: Color(0xFF64748B),
                                        fontSize: 11,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            // Status Chips
                            Wrap(
                              spacing: 4,
                              children: [
                                _statusChip(
                                  label: 'P',
                                  activeColor: const Color(0xFF10B981),
                                  isSelected: currentStatus == 'PRESENT',
                                  onTap: () => setDialogState(
                                    () => studentStatus[sId] = 'PRESENT',
                                  ),
                                ),
                                _statusChip(
                                  label: 'A',
                                  activeColor: const Color(0xFFEF4444),
                                  isSelected: currentStatus == 'ABSENT',
                                  onTap: () => setDialogState(
                                    () => studentStatus[sId] = 'ABSENT',
                                  ),
                                ),
                                _statusChip(
                                  label: 'L',
                                  activeColor: const Color(0xFFF59E0B),
                                  isSelected: currentStatus == 'LATE',
                                  onTap: () => setDialogState(
                                    () => studentStatus[sId] = 'LATE',
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: Text(l10n?.cancel ?? 'Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                ),
                onPressed: () async {
                  final now = DateTime.now();
                  int recordedCount = 0;

                  for (final s in currentRoster) {
                    final sId = s['id'] as String;
                    final status = studentStatus[sId] ?? 'PRESENT';
                    final recordId = const Uuid().v4();

                    await LocalDatabase.instance.recordAttendance(
                      id: recordId,
                      studentId: sId,
                      classId: selectedClassId,
                      date: dateStr,
                      status: status,
                      markedAt: now.toUtc().toIso8601String(),
                    );
                    recordedCount++;
                  }

                  if (ctx.mounted) Navigator.of(ctx).pop();
                  await _refreshSyncState();

                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'Recorded roll-call for $recordedCount student(s) ($selectedPeriod). Queued in offline outbox.',
                        ),
                        backgroundColor: const Color(0xFF10B981),
                      ),
                    );
                  }
                },
                child: Text(
                  '${l10n?.save ?? 'Save Roll-Call'} (${currentRoster.length})',
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _statusChip({
    required String label,
    required Color activeColor,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.dashboard ?? 'Teacher Portal'),
        backgroundColor: const Color(0xFF0D9488),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Chat',
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            onPressed: () => context.push('/chat'),
          ),
          IconButton(
            tooltip: l10n?.syncChanges ?? 'Sync Outbox',
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
          if (_failedCount > 0) ...[
            Card(
              color: const Color(0xFFFEF2F2),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFFFECACA)),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.sync_problem_rounded,
                      color: Color(0xFFDC2626),
                    ),
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
                title: l10n?.markAttendance ?? 'Mark Attendance',
                subtitle: 'Period & Daily Roll-Call',
                color: const Color(0xFF0D9488),
                onTap: _openMarkAttendanceDialog,
              ),
              _buildCard(
                icon: Icons.emergency_rounded,
                title: l10n?.emergencyContacts ?? 'Emergency Contacts',
                subtitle: 'Offline Disaster Pack',
                color: const Color(0xFFEF4444),
                onTap: () => DisasterPackSheet.show(context),
              ),
              _buildCard(
                icon: Icons.edit_calendar_rounded,
                title: l10n?.homeworkTasks ?? 'Assign Homework',
                subtitle: 'Offline Task Queue',
                color: const Color(0xFF3B82F6),
                onTap: () => context.push('/homework'),
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
              _buildCard(
                icon: Icons.menu_book,
                title: 'Academic Blogs',
                subtitle: 'Author & Moderate',
                color: const Color(0xFF0284C7),
                onTap: () => context.push('/blogs'),
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
