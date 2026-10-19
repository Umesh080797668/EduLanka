import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../core/download/download_manager.dart';
import '../../core/sync/sync_service.dart';
import '../../l10n/app_localizations.dart';
import '../tutorial/tutorial_engine.dart';

class PaperHubListScreen extends ConsumerStatefulWidget {
  const PaperHubListScreen({super.key});

  @override
  ConsumerState<PaperHubListScreen> createState() => _PaperHubListScreenState();
}

class _PaperHubListScreenState extends ConsumerState<PaperHubListScreen> {
  final ScrollController _scrollController = ScrollController();
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = false;
  int _currentPage = 1;
  int _total = 0;
  bool _isOfflineMode = false;
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
    _loadPapers(reset: true);

    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent - 200) {
        if (!_isLoading && !_isLoadingMore && _hasMore && !_isOfflineMode) {
          _loadMorePapers();
        }
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'phase3_papers_tour');
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
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
      final Map<String, Map<String, String>> found = {};

      if (await dirEntity.exists()) {
        final files = dirEntity.listSync();
        for (final f in files) {
          if (f is File) {
            final filename = p.basename(f.path);
            if (filename.endsWith('_paper.pdf') ||
                filename.endsWith('_paper.enc.pdf')) {
              final id = filename
                  .replaceAll('_paper.enc.pdf', '')
                  .replaceAll('_paper.pdf', '');
              found.putIfAbsent(id, () => {})['paper'] = f.path;
            } else if (filename.endsWith('_scheme.pdf') ||
                filename.endsWith('_scheme.enc.pdf')) {
              final id = filename
                  .replaceAll('_scheme.enc.pdf', '')
                  .replaceAll('_scheme.pdf', '');
              found.putIfAbsent(id, () => {})['scheme'] = f.path;
            }
          }
        }
      }

      // Check downloads directory where DownloadManager saves files
      final appDir = await getApplicationDocumentsDirectory();
      final downloadDir = Directory(p.join(appDir.path, 'downloads'));
      if (await downloadDir.exists()) {
        final files = downloadDir.listSync();
        for (final f in files) {
          if (f is File) {
            final filename = p.basename(f.path);
            if (filename.endsWith('_paper.pdf') ||
                filename.endsWith('_paper.enc.pdf')) {
              final id = filename
                  .replaceAll('_paper.enc.pdf', '')
                  .replaceAll('_paper.pdf', '');
              found.putIfAbsent(id, () => {})['paper'] = f.path;
            } else if (filename.endsWith('_scheme.pdf') ||
                filename.endsWith('_scheme.enc.pdf')) {
              final id = filename
                  .replaceAll('_scheme.enc.pdf', '')
                  .replaceAll('_scheme.pdf', '');
              found.putIfAbsent(id, () => {})['scheme'] = f.path;
            }
          }
        }
      }

      // Also check LocalDatabase for registered offline papers
      final dbPapers = await LocalDatabase.instance.getOfflinePapers();
      for (final pRow in dbPapers) {
        final id = pRow['id']?.toString() ?? '';
        final pPath = pRow['local_paper_path']?.toString();
        final sPath = pRow['local_scheme_path']?.toString();
        if (id.isNotEmpty) {
          if (pPath != null && File(pPath).existsSync()) {
            found.putIfAbsent(id, () => {})['paper'] = pPath;
          }
          if (sPath != null && File(sPath).existsSync()) {
            found.putIfAbsent(id, () => {})['scheme'] = sPath;
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

  Future<void> _loadPapers({bool reset = true}) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _isLoading = true;
      _error = null;
      if (reset) {
        _currentPage = 1;
        _papers = [];
      }
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.getPapers(
        page: _currentPage,
        limit: 20,
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

      final total = res['count'] is int
          ? res['count'] as int
          : (res['total'] is int ? res['total'] as int : 0);
      final hasMore = res['hasMore'] == true || papersList.length < total;

      if (mounted) {
        setState(() {
          _papers = papersList;
          _total = total;
          _hasMore = hasMore;
          _isOfflineMode = false;
          _isLoading = false;
        });
      }
      await _checkSavedPapers();
    } catch (e) {
      // Offline fallback: load cached papers from LocalDatabase (P3-S7 airplane mode)
      final offlinePapers = await LocalDatabase.instance.getOfflinePapers(
        subject: _selectedSubject,
        gradeLevel: _selectedGrade,
        medium: _selectedMedium,
        examType: _selectedExamType,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
          if (offlinePapers.isNotEmpty) {
            _papers = offlinePapers;
            _isOfflineMode = true;
            _hasMore = false;
            _error = null;
          } else {
            _error =
                l10n?.errorLoadingPapers ??
                'Failed to load papers. Check connection.';
          }
        });
      }
      await _checkSavedPapers();
    }
  }

  Future<void> _loadMorePapers() async {
    if (_isLoadingMore || !_hasMore || _isOfflineMode) return;
    setState(() => _isLoadingMore = true);

    try {
      final nextPage = _currentPage + 1;
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.getPapers(
        page: nextPage,
        limit: 20,
        subject: _selectedSubject == 'All' ? null : _selectedSubject,
        gradeLevel: _selectedGrade,
        medium: _selectedMedium,
        examType: _selectedExamType,
      );

      final rawList = res['data'];
      if (rawList is List && rawList.isNotEmpty) {
        final newItems = rawList
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        if (mounted) {
          setState(() {
            _currentPage = nextPage;
            _papers.addAll(newItems);
            _hasMore = res['hasMore'] == true || _papers.length < _total;
            _isLoadingMore = false;
          });
        }
        await _checkSavedPapers();
      } else {
        if (mounted) {
          setState(() {
            _hasMore = false;
            _isLoadingMore = false;
          });
        }
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingMore = false);
    }
  }

  Future<void> _downloadPaperAndScheme(Map<String, dynamic> paper) async {
    final l10n = AppLocalizations.of(context);
    final paperId = paper['id']?.toString() ?? '';
    final paperUrl = paper['paper_url']?.toString();
    final schemeUrl = paper['marking_scheme_url']?.toString();
    final title = paper['title']?.toString() ?? 'Examination Past Paper';

    if (paperId.isEmpty || paperUrl == null || paperUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            l10n?.paperDocumentUnavailable ??
                'Paper document URL is unavailable.',
          ),
        ),
      );
      return;
    }

    setState(() => _downloadingMap[paperId] = true);

    try {
      final paperFileName = '${paperId}_paper.enc.pdf';
      final schemeFileName = '${paperId}_scheme.enc.pdf';

      final syncService = ref.read(syncServiceProvider);
      final licenseRetention =
          syncService.videoRetentionDays ?? syncService.planRetentionDays;
      final auth = ref.read(authProvider);
      final plan = auth.tenantPlan ?? 'COMMUNITY';
      final fallbackDays = plan == 'INSTITUTIONAL'
          ? 90
          : (plan == 'GROWTH' ? 30 : 7);
      final retentionDays = (licenseRetention != null && licenseRetention > 0)
          ? licenseRetention
          : fallbackDays;

      // 1. Queue Paper PDF download with S6 AES-256-CTR encryption & expiry
      await DownloadManager.instance.startDownload(
        id: 'paper_$paperId',
        title: '$title (Paper)',
        remoteUrl: paperUrl,
        customFileName: paperFileName,
        retentionDays: retentionDays,
      );

      // 2. Queue Marking Scheme PDF download if present
      if (schemeUrl != null && schemeUrl.isNotEmpty) {
        await DownloadManager.instance.startDownload(
          id: 'scheme_$paperId',
          title: '$title (Scheme)',
          remoteUrl: schemeUrl,
          customFileName: schemeFileName,
          retentionDays: retentionDays,
        );
      }

      // 3. Await actual download completion before saving metadata or notifying user
      final completedPaper = await DownloadManager.instance.waitForCompletion(
        'paper_$paperId',
      );
      DownloadTask? completedScheme;
      if (schemeUrl != null && schemeUrl.isNotEmpty) {
        completedScheme = await DownloadManager.instance.waitForCompletion(
          'scheme_$paperId',
        );
      }

      final realPaperPath = completedPaper.localPath;
      final realSchemePath = completedScheme?.localPath;

      // 4. Save paper metadata locally in SQLCipher SQLite with REAL download paths (P3-S7)
      await LocalDatabase.instance.saveOfflinePaper(
        id: paperId,
        paper: paper,
        localPaperPath: realPaperPath,
        localSchemePath: realSchemePath,
        retentionDays: retentionDays,
      );

      if (mounted) {
        setState(() {
          _downloadingMap[paperId] = false;
          _localPathsMap[paperId] = {
            'paper': realPaperPath,
            'scheme': ?realSchemePath,
          };
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              l10n?.paperDownloaded ??
                  'Paper & Marking Scheme downloaded for offline study!',
            ),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _downloadingMap[paperId] = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              l10n?.errorDownloadFailed ??
                  'Failed to download paper. Please try again.',
            ),
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
            onPressed: () => _loadPapers(reset: true),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_isOfflineMode)
            Container(
              color: const Color(0xFFFEF3C7),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Icon(
                    Icons.cloud_off,
                    size: 18,
                    color: Color(0xFFD97706),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Offline / Airplane Mode: Showing ${_papers.length} saved papers',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF92400E),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          _buildFilterBar(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _error!,
                          style: const TextStyle(color: Colors.red),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: () => _loadPapers(reset: true),
                          child: Text(l10n?.retry ?? 'Retry'),
                        ),
                      ],
                    ),
                  )
                : _papers.isEmpty
                ? Center(
                    child: Text(
                      l10n?.noPapersFound ??
                          'No examination papers found matching current filters.',
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () => _loadPapers(reset: true),
                    child: ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(12),
                      itemCount: _papers.length + (_hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == _papers.length) {
                          return Center(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: _isLoadingMore
                                  ? const CircularProgressIndicator()
                                  : ElevatedButton(
                                      onPressed: _loadMorePapers,
                                      child: Text(
                                        l10n?.loadMore ?? 'Load More',
                                      ),
                                    ),
                            ),
                          );
                        }
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
