import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../l10n/app_localizations.dart';

class GradesScreen extends ConsumerStatefulWidget {
  final String? studentId;
  final String? studentName;

  const GradesScreen({super.key, this.studentId, this.studentName});

  @override
  ConsumerState<GradesScreen> createState() => _GradesScreenState();
}

class _GradesScreenState extends ConsumerState<GradesScreen> {
  bool _isLoading = true;
  bool _isDownloading = false;
  bool _isOffline = false;

  String? _resolvedStudentId;
  String? _resolvedStudentName;
  List<Map<String, dynamic>> _children = [];

  List<Map<String, dynamic>> _allMarks = [];
  int _selectedTerm = 1;
  int _selectedYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    _initAndLoadMarks();
  }

  Future<void> _initAndLoadMarks() async {
    setState(() => _isLoading = true);

    try {
      final auth = ref.read(authProvider);
      final client = ref.read(apiClientProvider);

      // 1. Resolve student ID
      if (widget.studentId != null && widget.studentId!.isNotEmpty) {
        _resolvedStudentId = widget.studentId;
        _resolvedStudentName = widget.studentName;
      } else if (auth.role == 'STUDENT') {
        final me = await client.getStudentMe();
        if (me != null) {
          _resolvedStudentId = me['id']?.toString();
          _resolvedStudentName = me['full_name']?.toString() ?? 'My Grades';
        }
      } else if (auth.role == 'PARENT') {
        final parentData = await client.getParentMe();
        if (parentData != null && parentData['children'] is List) {
          final kids = (parentData['children'] as List)
              .map((c) => Map<String, dynamic>.from(c as Map))
              .toList();
          _children = kids;
          if (kids.isNotEmpty) {
            _resolvedStudentId = kids.first['id']?.toString();
            _resolvedStudentName = kids.first['name']?.toString() ?? 'Child';
          }
        }
      }

      // Fallback: If still unresolved, try auth userId as fallback
      _resolvedStudentId ??= auth.userId;

      if (_resolvedStudentId != null) {
        await _fetchMarksForStudent(_resolvedStudentId!);
      }
    } catch (_) {
      // Offline fallback
      if (_resolvedStudentId != null) {
        await _loadCachedMarks(_resolvedStudentId!);
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchMarksForStudent(String studentId) async {
    try {
      final client = ref.read(apiClientProvider);
      final marks = await client.getStudentMarks(studentId);
      if (mounted) {
        setState(() {
          _allMarks = marks;
          _isOffline = false;
        });
      }
      // Cache marks locally
      await LocalDatabase.instance.saveSyncMetadata(
        'cached_marks_$studentId',
        jsonEncode(marks),
      );
    } catch (_) {
      await _loadCachedMarks(studentId);
    }
  }

  Future<void> _loadCachedMarks(String studentId) async {
    final cached = await LocalDatabase.instance.getSyncMetadata(
      'cached_marks_$studentId',
    );
    if (cached != null && cached.isNotEmpty) {
      try {
        final decoded = jsonDecode(cached);
        if (decoded is List && mounted) {
          setState(() {
            _allMarks = decoded
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
            _isOffline = true;
          });
          return;
        }
      } catch (_) {}
    }
    if (mounted) setState(() => _isOffline = true);
  }

  List<Map<String, dynamic>> get _currentTermMarks {
    return _allMarks.where((m) {
      final t = m['term']?.toString();
      final yr = m['academic_year']?.toString();
      final matchesTerm = t == _selectedTerm.toString();
      final matchesYear = yr == null || yr == _selectedYear.toString();
      return matchesTerm && matchesYear;
    }).toList();
  }

  String _getGradeLetter(num mark) {
    if (mark >= 75) return 'A';
    if (mark >= 65) return 'B';
    if (mark >= 50) return 'C';
    if (mark >= 35) return 'S';
    return 'F';
  }

  Color _getGradeColor(String letter) {
    switch (letter) {
      case 'A':
        return const Color(0xFF10B981);
      case 'B':
        return const Color(0xFF3B82F6);
      case 'C':
        return const Color(0xFFF59E0B);
      case 'S':
        return const Color(0xFF8B5CF6);
      case 'F':
      default:
        return const Color(0xFFEF4444);
    }
  }

  Future<void> _downloadAndOpenReportCard() async {
    if (_resolvedStudentId == null) return;

    setState(() => _isDownloading = true);

    try {
      final client = ref.read(apiClientProvider);
      final pdfBytes = await client.downloadReportCard(
        studentId: _resolvedStudentId!,
        term: _selectedTerm,
        year: _selectedYear,
      );

      if (pdfBytes.isEmpty) {
        throw Exception('Received empty report card document');
      }

      final appDir = await getApplicationDocumentsDirectory();
      final fileName =
          'report-card-$_resolvedStudentId-term$_selectedTerm-$_selectedYear.pdf';
      final file = File(p.join(appDir.path, fileName));
      await file.writeAsBytes(pdfBytes);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Report Card (Term $_selectedTerm) downloaded.'),
          backgroundColor: const Color(0xFF10B981),
          action: SnackBarAction(
            label: 'VIEW PDF',
            textColor: Colors.white,
            onPressed: () {
              context.push(
                '/paper-viewer',
                extra: {
                  'title': 'Report Card - Term $_selectedTerm ($_selectedYear)',
                  'localFilePath': file.path,
                },
              );
            },
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to download report card: ${e.toString()}'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isDownloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final termMarks = _currentTermMarks;
    final hasMarks = termMarks.isNotEmpty;

    // Calculate term metrics
    double totalMarks = 0;
    for (final m in termMarks) {
      final val = m['mark'] as num? ?? 0;
      totalMarks += val;
    }
    final avgMarks = hasMarks
        ? (totalMarks / termMarks.length).toStringAsFixed(1)
        : '0';
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(_resolvedStudentName ?? 'Academic Grades'),
        backgroundColor: const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: l10n?.refresh ?? 'Refresh Marks',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _isLoading
                ? null
                : () => _fetchMarksForStudent(_resolvedStudentId!),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Offline banner if needed
                if (_isOffline)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    color: const Color(0xFFFEF3C7),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.cloud_off_rounded,
                          color: Color(0xFFD97706),
                          size: 18,
                        ),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Offline Mode — Viewing saved academic records.',
                            style: TextStyle(
                              color: Color(0xFF92400E),
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Child selector if Parent with multiple kids
                if (_children.length > 1) ...[
                  Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _resolvedStudentId,
                          isExpanded: true,
                          items: _children.map((child) {
                            return DropdownMenuItem<String>(
                              value: child['id']?.toString(),
                              child: Text(
                                child['name']?.toString() ?? 'Child',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            );
                          }).toList(),
                          onChanged: (newId) {
                            if (newId != null && newId != _resolvedStudentId) {
                              final kid = _children.firstWhere(
                                (c) => c['id'] == newId,
                              );
                              setState(() {
                                _resolvedStudentId = newId;
                                _resolvedStudentName = kid['name']?.toString();
                              });
                              _fetchMarksForStudent(newId);
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Term & Year Filter Cards
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: SegmentedButton<int>(
                        segments: const [
                          ButtonSegment<int>(value: 1, label: Text('Term 1')),
                          ButtonSegment<int>(value: 2, label: Text('Term 2')),
                          ButtonSegment<int>(value: 3, label: Text('Term 3')),
                        ],
                        selected: {_selectedTerm},
                        onSelectionChanged: (set) {
                          setState(() => _selectedTerm = set.first);
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    DropdownButton<int>(
                      value: _selectedYear,
                      items: [
                        DropdownMenuItem(
                          value: DateTime.now().year,
                          child: Text('${DateTime.now().year}'),
                        ),
                        DropdownMenuItem(
                          value: DateTime.now().year - 1,
                          child: Text('${DateTime.now().year - 1}'),
                        ),
                      ],
                      onChanged: (yr) {
                        if (yr != null) setState(() => _selectedYear = yr);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Performance Summary Card
                Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  color: const Color(0xFFEFF6FF),
                  elevation: 1,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        Column(
                          children: [
                            const Text(
                              'Average',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '$avgMarks%',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 22,
                                color: Color(0xFF1E40AF),
                              ),
                            ),
                          ],
                        ),
                        Container(
                          width: 1,
                          height: 40,
                          color: const Color(0xFFCBD5E1),
                        ),
                        Column(
                          children: [
                            const Text(
                              'Total Score',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${totalMarks.toInt()}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 22,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                        Container(
                          width: 1,
                          height: 40,
                          color: const Color(0xFFCBD5E1),
                        ),
                        Column(
                          children: [
                            const Text(
                              'Subjects',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${termMarks.length}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 22,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Download Official Report Card Button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E40AF),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    icon: _isDownloading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.picture_as_pdf_rounded),
                    label: Text(
                      _isDownloading
                          ? 'Generating PDF...'
                          : 'Download Term $_selectedTerm Report Card',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    onPressed: _isDownloading
                        ? null
                        : _downloadAndOpenReportCard,
                  ),
                ),
                const SizedBox(height: 20),

                const Text(
                  'Subject Breakdown',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 8),

                if (!hasMarks)
                  Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Padding(
                      padding: EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.assessment_outlined,
                            size: 48,
                            color: Color(0xFF94A3B8),
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No Marks Recorded',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Exam marks for this term have not been recorded or finalized yet.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ...termMarks.map((markItem) {
                    final subject =
                        markItem['subject']?.toString() ?? 'Subject';
                    final mark = markItem['mark'] as num? ?? 0;
                    final letter = _getGradeLetter(mark);
                    final color = _getGradeColor(letter);
                    final remarks = markItem['remarks']?.toString();

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: color.withValues(alpha: 0.15),
                              radius: 22,
                              child: Text(
                                letter,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 18,
                                  color: color,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    subject,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                  if (remarks != null && remarks.isNotEmpty)
                                    Text(
                                      remarks,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF64748B),
                                        fontStyle: FontStyle.italic,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            Text(
                              '${mark.toInt()} / 100',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
    );
  }
}
