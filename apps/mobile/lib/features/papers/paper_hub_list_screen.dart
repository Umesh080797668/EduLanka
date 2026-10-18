import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/api/api_client.dart';
import '../../l10n/app_localizations.dart';
import '../tutorial/tutorial_engine.dart';

class PaperHubListScreen extends ConsumerStatefulWidget {
  const PaperHubListScreen({super.key});

  @override
  ConsumerState<PaperHubListScreen> createState() => _PaperHubListScreenState();
}

class _PaperHubListScreenState extends ConsumerState<PaperHubListScreen> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _papers = [];
  final Map<String, bool> _downloadingMap = {};
  final Map<String, Map<String, String>> _localPathsMap = {};

  String? _selectedSubject;
  int? _selectedGrade;
  String? _selectedMedium;
  String? _selectedExamType;

  final List<String> _subjects = [
    'All',
    'Mathematics',
    'Science',
    'English',
    'Sinhala',
    'Tamil',
    'History',
    'ICT',
    'Commerce',
  ];

  final List<int?> _grades = [null, 6, 7, 8, 9, 10, 11, 12, 13];
  final List<String?> _mediums = [null, 'SINHALA', 'TAMIL', 'ENGLISH'];
  final List<String?> _examTypes = [
    null,
    'TERM_1',
    'TERM_2',
    'TERM_3',
    'OL',
    'AL',
    'SCHOLARSHIP',
  ];

  @override
  void initState() {
    super.initState();
    _checkSavedPapers();
    _loadPapers();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'phase3_papers_tour');
    });
  }

  Future<String> get _offlinePapersDir async {
    final appDir = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(appDir.path, 'offline_papers'));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir.path;
  }

  Future<void> _checkSavedPapers() async {
    try {
      final dir = await _offlinePapersDir;
      final dirEntity = Directory(dir);
      if (!await dirEntity.exists()) return;

      final files = dirEntity.listSync();
      final Map<String, Map<String, String>> found = {};

      for (final f in files) {
        if (f is File) {
          final filename = p.basename(f.path);
          if (filename.endsWith('_paper.pdf')) {
            final id = filename.replaceAll('_paper.pdf', '');
            found.putIfAbsent(id, () => {})['paper'] = f.path;
          } else if (filename.endsWith('_scheme.pdf')) {
            final id = filename.replaceAll('_scheme.pdf', '');
            found.putIfAbsent(id, () => {})['scheme'] = f.path;
          }
        }
      }

      if (mounted) {
        setState(() {
          _localPathsMap.clear();
          _localPathsMap.addAll(found);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadPapers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.getPapers(
        subject: _selectedSubject == 'All' ? null : _selectedSubject,
        gradeLevel: _selectedGrade,
        medium: _selectedMedium,
        examType: _selectedExamType,
      );

      final rawList = res['data'];
      List<Map<String, dynamic>> papersList = [];
      if (rawList is List) {
        papersList = rawList
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
      }

      if (mounted) {
        setState(() {
          _papers = papersList;
          _isLoading = false;
        });
      }
      await _checkSavedPapers();
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _downloadPaperAndScheme(Map<String, dynamic> paper) async {
    final paperId = paper['id']?.toString() ?? '';
    final paperUrl = paper['paper_url']?.toString();
    final schemeUrl = paper['marking_scheme_url']?.toString();

    if (paperId.isEmpty || paperUrl == null || paperUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Paper document URL is unavailable.')),
      );
      return;
    }

    setState(() => _downloadingMap[paperId] = true);
    final dir = await _offlinePapersDir;
    final paperFile = File(p.join(dir, '${paperId}_paper.pdf'));
    final schemeFile = File(p.join(dir, '${paperId}_scheme.pdf'));

    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 60),
      ),
    );

    try {
      // 1. Download Paper PDF
      await dio.download(paperUrl, paperFile.path);

      // 2. Download Marking Scheme PDF if present
      if (schemeUrl != null && schemeUrl.isNotEmpty) {
        await dio.download(schemeUrl, schemeFile.path);
      }

      if (mounted) {
        setState(() {
          _downloadingMap[paperId] = false;
          _localPathsMap[paperId] = {
            'paper': paperFile.path,
            if (schemeUrl != null && schemeUrl.isNotEmpty)
              'scheme': schemeFile.path,
          };
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Paper & Marking Scheme downloaded for offline study!',
            ),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _downloadingMap[paperId] = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to download paper: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _openViewer(Map<String, dynamic> paper) {
    final paperId = paper['id']?.toString() ?? '';
    final title = paper['title']?.toString() ?? 'Examination Past Paper';
    final paperUrl = paper['paper_url']?.toString();
    final schemeUrl = paper['marking_scheme_url']?.toString();

    final localPaths = _localPathsMap[paperId];
    final localFilePath = localPaths?['paper'];
    final localMarkingSchemePath = localPaths?['scheme'];

    context.push(
      '/paper-viewer',
      extra: {
        'title': title,
        'paperUrl': paperUrl,
        'localFilePath': localFilePath,
        'markingSchemeUrl': schemeUrl,
        'localMarkingSchemePath': localMarkingSchemePath,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.pastPaperHub ?? 'Examination Past Paper Hub'),
        backgroundColor: const Color(0xFF0F766E),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Papers',
            onPressed: _loadPapers,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterBar(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Error: $_error'),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _loadPapers,
                          child: Text(l10n?.retry ?? 'Retry'),
                        ),
                      ],
                    ),
                  )
                : _papers.isEmpty
                ? const Center(
                    child: Text(
                      'No examination papers found matching current filters.',
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _loadPapers,
                    child: ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _papers.length,
                      itemBuilder: (context, index) {
                        final paper = _papers[index];
                        return _buildPaperCard(paper);
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        children: [
          // Subjects
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _subjects.map((sub) {
                final isSelected =
                    (_selectedSubject == null && sub == 'All') ||
                    _selectedSubject == sub;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: FilterChip(
                    label: Text(sub),
                    selected: isSelected,
                    selectedColor: const Color(0xFFCCFBF1),
                    checkmarkColor: const Color(0xFF0F766E),
                    labelStyle: TextStyle(
                      color: isSelected
                          ? const Color(0xFF0F766E)
                          : const Color(0xFF475569),
                      fontWeight: isSelected
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                    onSelected: (val) {
                      setState(() {
                        _selectedSubject = sub == 'All' ? null : sub;
                      });
                      _loadPapers();
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 4),
          // Grades & Mediums
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ..._grades.map((grade) {
                  final isSelected = _selectedGrade == grade;
                  final label = grade == null ? 'All Grades' : 'Grade $grade';
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(label),
                      selected: isSelected,
                      selectedColor: const Color(0xFFE0E7FF),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        color: isSelected
                            ? const Color(0xFF4338CA)
                            : const Color(0xFF475569),
                        fontWeight: isSelected
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                      onSelected: (val) {
                        setState(() => _selectedGrade = grade);
                        _loadPapers();
                      },
                    ),
                  );
                }),
                const SizedBox(width: 8),
                ..._mediums.map((med) {
                  final isSelected = _selectedMedium == med;
                  final label = med ?? 'All Mediums';
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(label),
                      selected: isSelected,
                      selectedColor: const Color(0xFFFEF3C7),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        color: isSelected
                            ? const Color(0xFFB45309)
                            : const Color(0xFF475569),
                        fontWeight: isSelected
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                      onSelected: (val) {
                        setState(() => _selectedMedium = med);
                        _loadPapers();
                      },
                    ),
                  );
                }),
                const SizedBox(width: 8),
                ..._examTypes.map((et) {
                  final isSelected = _selectedExamType == et;
                  final label = et ?? 'All Exams';
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(label),
                      selected: isSelected,
                      selectedColor: const Color(0xFFF3E8FF),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        color: isSelected
                            ? const Color(0xFF7E22CE)
                            : const Color(0xFF475569),
                        fontWeight: isSelected
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                      onSelected: (val) {
                        setState(() => _selectedExamType = et);
                        _loadPapers();
                      },
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaperCard(Map<String, dynamic> paper) {
    final l10n = AppLocalizations.of(context);
    final paperId = paper['id']?.toString() ?? '';
    final title = paper['title']?.toString() ?? 'Examination Paper';
    final subject = paper['subject']?.toString() ?? '';
    final grade = paper['grade_level'] != null
        ? 'Grade ${paper['grade_level']}'
        : '';
    final year = paper['year'] != null ? '${paper['year']}' : '';
    final medium = paper['medium']?.toString() ?? '';
    final examType = paper['exam_type']?.toString() ?? '';
    final hasScheme =
        paper['marking_scheme_url'] != null &&
        paper['marking_scheme_url'].toString().isNotEmpty;

    final isDownloading = _downloadingMap[paperId] == true;
    final isSavedOffline =
        _localPathsMap[paperId] != null &&
        File(_localPathsMap[paperId]!['paper'] ?? '').existsSync();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDFA),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFCCFBF1)),
                  ),
                  child: const Icon(
                    Icons.picture_as_pdf_rounded,
                    color: Color(0xFF0F766E),
                    size: 28,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (subject.isNotEmpty)
                            _badge(subject, const Color(0xFF0F766E)),
                          if (grade.isNotEmpty)
                            _badge(grade, const Color(0xFF475569)),
                          if (year.isNotEmpty)
                            _badge(year, const Color(0xFF2563EB)),
                          if (medium.isNotEmpty)
                            _badge(medium, const Color(0xFFD97706)),
                          if (examType.isNotEmpty)
                            _badge(examType, const Color(0xFF7C3AED)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    if (hasScheme)
                      Row(
                        children: [
                          const Icon(
                            Icons.check_circle,
                            size: 14,
                            color: Color(0xFF059669),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            l10n?.schemePaired ?? 'Scheme Paired',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF059669),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      )
                    else
                      Text(
                        l10n?.paperOnly ?? 'Paper Only',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    if (isSavedOffline) ...[
                      const SizedBox(width: 8),
                      Chip(
                        avatar: const Icon(
                          Icons.offline_pin,
                          size: 14,
                          color: Colors.green,
                        ),
                        label: Text(
                          l10n?.offlineReady ?? 'Offline Saved',
                          style: const TextStyle(fontSize: 10),
                        ),
                        backgroundColor: const Color(0xFFECFDF5),
                        padding: EdgeInsets.zero,
                      ),
                    ],
                  ],
                ),
                Row(
                  children: [
                    if (!isSavedOffline)
                      IconButton(
                        icon: isDownloading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(
                                Icons.download_for_offline_outlined,
                                color: Color(0xFF0F766E),
                              ),
                        tooltip: 'Save Paper & Scheme Offline',
                        onPressed: isDownloading
                            ? null
                            : () => _downloadPaperAndScheme(paper),
                      ),
                    const SizedBox(width: 6),
                    ElevatedButton.icon(
                      icon: const Icon(Icons.open_in_new, size: 16),
                      label: Text(l10n?.view ?? 'View'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F766E),
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () => _openViewer(paper),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
