import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../l10n/app_localizations.dart';

class AttendanceScreen extends ConsumerStatefulWidget {
  final String? studentId;
  final String? studentName;

  const AttendanceScreen({super.key, this.studentId, this.studentName});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  bool _isLoading = true;
  bool _isOffline = false;

  String? _resolvedStudentId;
  String? _resolvedStudentName;
  List<Map<String, dynamic>> _children = [];

  List<Map<String, dynamic>> _records = [];
  Map<String, dynamic> _summary = {
    'total': 0,
    'present': 0,
    'absent': 0,
    'late': 0,
    'excused': 0,
    'attendancePercentage': 100,
  };

  @override
  void initState() {
    super.initState();
    _initAndLoadAttendance();
  }

  Future<void> _initAndLoadAttendance() async {
    setState(() => _isLoading = true);

    try {
      final auth = ref.read(authProvider);
      final client = ref.read(apiClientProvider);

      if (widget.studentId != null && widget.studentId!.isNotEmpty) {
        _resolvedStudentId = widget.studentId;
        _resolvedStudentName = widget.studentName;
      } else if (auth.role == 'STUDENT') {
        _resolvedStudentName = 'My Attendance';
      } else if (auth.role == 'PARENT') {
        try {
          final response = await client.dio.get('/parents/me');
          final res = response.data as Map<String, dynamic>?;
          if (res != null && res['children'] is List) {
            _children = List<Map<String, dynamic>>.from(res['children']);
            if (_children.isNotEmpty) {
              _resolvedStudentId = _children.first['id']?.toString();
              _resolvedStudentName =
                  _children.first['name']?.toString() ?? 'Child';
            }
          }
        } catch (_) {}
      }

      await _fetchRecords();
    } catch (_) {
      _loadOfflineAttendance();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchRecords() async {
    final auth = ref.read(authProvider);
    final client = ref.read(apiClientProvider);

    try {
      Map<String, dynamic>? res;
      if (auth.role == 'STUDENT') {
        final resp = await client.dio.get('/attendance/my-attendance');
        res = resp.data as Map<String, dynamic>?;
      } else if (_resolvedStudentId != null) {
        final resp = await client.dio.get(
          '/attendance/student/$_resolvedStudentId',
        );
        res = resp.data as Map<String, dynamic>?;
      }

      if (res != null) {
        final recs =
            (res['records'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e))
                .toList() ??
            [];
        final sum = res['summary'] as Map<String, dynamic>? ?? {};

        setState(() {
          _records = recs;
          _summary = {
            'total': sum['total'] ?? recs.length,
            'present': sum['present'] ?? 0,
            'absent': sum['absent'] ?? 0,
            'late': sum['late'] ?? 0,
            'excused': sum['excused'] ?? 0,
            'attendancePercentage': sum['attendancePercentage'] ?? 100,
          };
          _isOffline = false;
        });
        return;
      }
    } catch (e) {
      debugPrint('Error fetching attendance online: $e');
    }

    // Fallback to local offline SQLite database
    await _loadOfflineAttendance();
  }

  Future<void> _loadOfflineAttendance() async {
    try {
      final rows = await LocalDatabase.instance.driftDb
          .customSelect(
            'SELECT * FROM offline_attendance ORDER BY date DESC, marked_at DESC',
          )
          .get();

      final recs = rows.map((r) => r.data).toList();
      int present = recs.where((r) => r['status'] == 'PRESENT').length;
      int absent = recs.where((r) => r['status'] == 'ABSENT').length;
      int late = recs.where((r) => r['status'] == 'LATE').length;
      int excused = recs.where((r) => r['status'] == 'EXCUSED').length;
      int total = recs.length;
      int pct = total > 0 ? (((present + late) / total) * 100).round() : 100;

      setState(() {
        _records = recs;
        _summary = {
          'total': total,
          'present': present,
          'absent': absent,
          'late': late,
          'excused': excused,
          'attendancePercentage': pct,
        };
        _isOffline = true;
      });
    } catch (_) {}
  }

  Widget _buildStatusChip(String status) {
    Color bg;
    Color fg;
    IconData icon;

    switch (status.toUpperCase()) {
      case 'PRESENT':
        bg = const Color(0xFFDCFCE7);
        fg = const Color(0xFF15803D);
        icon = Icons.check_circle_rounded;
        break;
      case 'ABSENT':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFFB91C1C);
        icon = Icons.cancel_rounded;
        break;
      case 'LATE':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFB45309);
        icon = Icons.access_time_filled_rounded;
        break;
      case 'EXCUSED':
        bg = const Color(0xFFE0F2FE);
        fg = const Color(0xFF0369A1);
        icon = Icons.info_rounded;
        break;
      default:
        bg = Colors.grey.shade200;
        fg = Colors.grey.shade800;
        icon = Icons.help_outline_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 4),
          Text(
            status,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final rate = _summary['attendancePercentage'] as int? ?? 100;
    final rateColor = rate >= 85
        ? const Color(0xFF16A34A)
        : rate >= 70
        ? const Color(0xFFD97706)
        : const Color(0xFFDC2626);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.studentName ??
              _resolvedStudentName ??
              l10n?.attendanceHistory ??
              'Attendance Log',
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchRecords,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Children selector for parent
                  if (_children.length > 1) ...[
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _children.map((c) {
                          final isSelected =
                              c['id']?.toString() == _resolvedStudentId;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: FilterChip(
                              label: Text(c['name']?.toString() ?? 'Child'),
                              selected: isSelected,
                              onSelected: (_) {
                                setState(() {
                                  _resolvedStudentId = c['id']?.toString();
                                  _resolvedStudentName = c['name']?.toString();
                                });
                                _fetchRecords();
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Offline indicator banner
                  if (_isOffline) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        border: Border.all(color: Colors.amber.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.wifi_off_rounded,
                            size: 18,
                            color: Colors.amber.shade800,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Viewing cached offline attendance records.',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.amber.shade900,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Summary Metric Card
                  Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Attendance Consistency',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black54,
                                ),
                              ),
                              Text(
                                '$rate%',
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  color: rateColor,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: LinearProgressIndicator(
                              value: (rate / 100).clamp(0.0, 1.0),
                              backgroundColor: Colors.grey.shade200,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                rateColor,
                              ),
                              minHeight: 8,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              _buildMetricItem(
                                'Present',
                                '${_summary['present']}',
                                const Color(0xFF16A34A),
                              ),
                              _buildMetricItem(
                                'Absent',
                                '${_summary['absent']}',
                                const Color(0xFFDC2626),
                              ),
                              _buildMetricItem(
                                'Late',
                                '${_summary['late']}',
                                const Color(0xFFD97706),
                              ),
                              _buildMetricItem(
                                'Total',
                                '${_summary['total']}',
                                Colors.black87,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),
                  const Text(
                    'Recorded Roll-Call Sessions',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 10),

                  if (_records.isEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Column(
                        children: [
                          Icon(
                            Icons.event_busy_rounded,
                            size: 48,
                            color: Colors.grey.shade400,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No Attendance Records Found',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    ..._records.map((rec) {
                      final date = rec['date']?.toString() ?? 'N/A';
                      final period = rec['period']?.toString() ?? '1';
                      final status = rec['status']?.toString() ?? 'PRESENT';

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 4,
                          ),
                          leading: CircleAvatar(
                            backgroundColor: Colors.blue.shade50,
                            child: Icon(
                              Icons.calendar_today_rounded,
                              size: 20,
                              color: Colors.blue.shade700,
                            ),
                          ),
                          title: Text(
                            date,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          subtitle: Text(
                            'Period $period',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          trailing: _buildStatusChip(status),
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildMetricItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Colors.black54),
        ),
      ],
    );
  }
}
