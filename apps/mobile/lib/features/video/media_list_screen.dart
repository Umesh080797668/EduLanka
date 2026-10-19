import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/download/download_manager.dart';
import '../../l10n/app_localizations.dart';
import '../tutorial/tutorial_engine.dart';

class MediaListScreen extends ConsumerStatefulWidget {
  const MediaListScreen({super.key});

  @override
  ConsumerState<MediaListScreen> createState() => _MediaListScreenState();
}

class _MediaListScreenState extends ConsumerState<MediaListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = false;
  int _currentPage = 1;
  int _total = 0;
  String? _error;
  List<Map<String, dynamic>> _assets = [];

  String? _selectedSubject;
  int? _selectedGrade;

  final List<String> _subjects = [
    'All',
    'Science',
    'Mathematics',
    'English',
    'Sinhala',
    'Tamil',
    'History',
    'ICT',
    'Commerce',
  ];

  final List<int?> _grades = [null, 6, 7, 8, 9, 10, 11, 12, 13];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadMediaAssets(reset: true);

    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent - 200) {
        if (!_isLoading && !_isLoadingMore && _hasMore) {
          _loadMoreMediaAssets();
        }
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'phase3_video_tour');
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  bool _isEmbed(Map<String, dynamic> asset) {
    final publicId = asset['cloudinary_public_id']?.toString() ?? '';
    if (publicId.startsWith('embed_')) return true;
    final url =
        (asset['hls_url'] ?? asset['mp4_url'] ?? asset['cloudinary_secure_url'])
            ?.toString() ??
        '';
    final u = url.toLowerCase();
    return u.contains('youtube.com') ||
        u.contains('youtu.be') ||
        u.contains('vimeo.com') ||
        u.contains('drive.google.com') ||
        (!u.endsWith('.mp4') &&
            !u.endsWith('.m3u8') &&
            asset['hls_url'] == null &&
            asset['mp4_url'] == null);
  }

  Future<void> _loadMediaAssets({bool reset = true}) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _isLoading = true;
      _error = null;
      if (reset) {
        _currentPage = 1;
        _assets = [];
      }
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.getMediaAssets(
        page: _currentPage,
        limit: 20,
        subject: _selectedSubject == 'All' ? null : _selectedSubject,
        gradeLevel: _selectedGrade,
      );

      final rawList = res['data'];
      List<Map<String, dynamic>> assetsList = [];
      if (rawList is List) {
        assetsList = rawList
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
      }

      final total = res['count'] is int
          ? res['count'] as int
          : (res['total'] is int ? res['total'] as int : 0);
      final hasMore = res['hasMore'] == true || assetsList.length < total;

      if (mounted) {
        setState(() {
          _assets = assetsList;
          _total = total;
          _hasMore = hasMore;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error =
              l10n?.errorLoadingLessons ??
              'Error loading lessons. Please try again.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadMoreMediaAssets() async {
    if (_isLoadingMore || !_hasMore) return;
    setState(() => _isLoadingMore = true);

    try {
      final nextPage = _currentPage + 1;
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.getMediaAssets(
        page: nextPage,
        limit: 20,
        subject: _selectedSubject == 'All' ? null : _selectedSubject,
        gradeLevel: _selectedGrade,
      );

      final rawList = res['data'];
      if (rawList is List && rawList.isNotEmpty) {
        final newItems = rawList
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        if (mounted) {
          setState(() {
            _currentPage = nextPage;
            _assets.addAll(newItems);
            _hasMore = res['hasMore'] == true || _assets.length < _total;
            _isLoadingMore = false;
          });
        }
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

  Future<void> _onPlayAsset(Map<String, dynamic> asset) async {
    final l10n = AppLocalizations.of(context);
    final title = asset['title']?.toString() ?? 'Curriculum Video Lesson';
    final videoUrl =
        asset['hls_url']?.toString() ??
        asset['mp4_url']?.toString() ??
        asset['cloudinary_secure_url']?.toString();

    if (videoUrl == null || videoUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            l10n?.videoUrlUnavailable ?? 'Video playback URL is not available',
          ),
        ),
      );
      return;
    }

    if (_isEmbed(asset)) {
      final uri = Uri.parse(videoUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (!mounted) return;
        context.push(
          '/video-player',
          extra: {'title': title, 'videoUrl': videoUrl, 'assetId': asset['id']},
        );
      }
      return;
    }

    if (!mounted) return;
    context.push(
      '/video-player',
      extra: {'title': title, 'videoUrl': videoUrl, 'assetId': asset['id']},
    );
  }

  Future<void> _onDownloadAsset(Map<String, dynamic> asset) async {
    final l10n = AppLocalizations.of(context);
    final auth = ref.read(authProvider);
    final plan = auth.tenantPlan ?? 'COMMUNITY';
    final isGrowthOrAbove = plan == 'GROWTH' || plan == 'INSTITUTIONAL';

    if (!isGrowthOrAbove) {
      await showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.workspace_premium, color: Color(0xFFF59E0B)),
              const SizedBox(width: 8),
              Text(
                AppLocalizations.of(ctx)?.planUpgradeRequired ??
                    'Plan Upgrade Required',
              ),
            ],
          ),
          content: Text(
            AppLocalizations.of(ctx)?.planUpgradeDesc ??
                'Offline encrypted lesson downloads with local playback are exclusive to schools on the Growth and Institutional tiers (ADR-001).\n\nPlease contact your school administrator to upgrade.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(AppLocalizations.of(ctx)?.ok ?? 'OK'),
            ),
          ],
        ),
      );
      return;
    }

    final assetId = asset['id']?.toString() ?? '';
    if (assetId.isEmpty) return;

    try {
      final apiClient = ref.read(apiClientProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              l10n?.startingEncryptedDownload ??
                  'Starting encrypted download...',
            ),
            duration: const Duration(seconds: 2),
          ),
        );
      }

      await DownloadManager.instance.enqueueFromManifest(
        assetId,
        apiClient: apiClient,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Download queued! Track progress in Offline Library.',
            ),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              l10n?.errorDownloadFailed ??
                  'Failed to start download. Please try again.',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final downloadTasks = ref.watch(downloadManagerProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.videoLessons ?? 'Curriculum Video Lessons'),
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF38BDF8),
          tabs: [
            Tab(
              icon: const Icon(Icons.video_library_rounded, size: 20),
              text: l10n?.curriculumLessons ?? 'Online Lessons',
            ),
            Tab(
              icon: const Icon(Icons.download_done_rounded, size: 20),
              text: l10n?.offlineVideos ?? 'Offline Library',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildOnlineLessonsTab(downloadTasks),
          _buildOfflineLibraryTab(downloadTasks),
        ],
      ),
    );
  }

  Widget _buildOnlineLessonsTab(Map<String, DownloadTask> downloadTasks) {
    final l10n = AppLocalizations.of(context);
    return Column(
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
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => _loadMediaAssets(reset: true),
                        child: Text(l10n?.retry ?? 'Retry'),
                      ),
                    ],
                  ),
                )
              : _assets.isEmpty
              ? Center(
                  child: Text(
                    l10n?.noVideoLessonsFound ??
                        'No video lessons found for this filter.',
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => _loadMediaAssets(reset: true),
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(12),
                    itemCount: _assets.length + (_hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _assets.length) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            child: _isLoadingMore
                                ? const CircularProgressIndicator()
                                : ElevatedButton(
                                    onPressed: _loadMoreMediaAssets,
                                    child: Text(l10n?.loadMore ?? 'Load More'),
                                  ),
                          ),
                        );
                      }
                      final asset = _assets[index];
                      final assetId = asset['id']?.toString() ?? '';
                      final task = downloadTasks[assetId];
                      return _buildLessonCard(asset, task);
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildFilterBar() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        children: [
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
                    selectedColor: const Color(0xFFDBEAFE),
                    checkmarkColor: const Color(0xFF1D4ED8),
                    labelStyle: TextStyle(
                      color: isSelected
                          ? const Color(0xFF1D4ED8)
                          : const Color(0xFF475569),
                      fontWeight: isSelected
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                    onSelected: (val) {
                      setState(() {
                        _selectedSubject = sub == 'All' ? null : sub;
                      });
                      _loadMediaAssets();
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 4),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _grades.map((grade) {
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
                      setState(() {
                        _selectedGrade = grade;
                      });
                      _loadMediaAssets();
                    },
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLessonCard(Map<String, dynamic> asset, DownloadTask? task) {
    final l10n = AppLocalizations.of(context);
    final title = asset['title']?.toString() ?? 'Lesson';
    final subject = asset['subject']?.toString() ?? 'Curriculum';
    final grade = asset['grade_level'] != null
        ? 'Grade ${asset['grade_level']}'
        : '';
    final durationSecs = (asset['duration_seconds'] as num?)?.toInt() ?? 0;
    final durationStr = durationSecs > 0
        ? '${durationSecs ~/ 60}m ${durationSecs % 60}s'
        : '';
    final isReady = asset['status'] == 'ready';

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
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.play_circle_fill_rounded,
                    color: Color(0xFF2563EB),
                    size: 32,
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
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              subject,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF475569),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          if (grade.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Text(
                              grade,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                          if (durationStr.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Text(
                              '• $durationStr',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (_isEmbed(asset)) ...[
                  ElevatedButton.icon(
                    icon: const Icon(Icons.open_in_new, size: 16),
                    label: Text(l10n?.watch ?? 'Watch'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                    ),
                    onPressed: () => _onPlayAsset(asset),
                  ),
                ] else ...[
                  if (task != null && task.status == DownloadStatus.downloading)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: SizedBox(
                        width: 120,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            LinearProgressIndicator(value: task.progress),
                            const SizedBox(height: 2),
                            Text(
                              '${(task.progress * 100).toInt()}% Encrypting',
                              style: const TextStyle(fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                    )
                  else if (task != null &&
                      task.status == DownloadStatus.completed)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Chip(
                        avatar: const Icon(
                          Icons.check_circle,
                          size: 16,
                          color: Colors.green,
                        ),
                        label: Text(
                          l10n?.offlineReady ?? 'Offline Ready',
                          style: const TextStyle(fontSize: 11),
                        ),
                        backgroundColor: const Color(0xFFECFDF5),
                        padding: EdgeInsets.zero,
                      ),
                    )
                  else
                    OutlinedButton.icon(
                      icon: const Icon(Icons.download, size: 16),
                      label: Text(l10n?.download ?? 'Download'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0D9488),
                      ),
                      onPressed: isReady ? () => _onDownloadAsset(asset) : null,
                    ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.play_arrow, size: 18),
                    label: Text(l10n?.play ?? 'Play'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                    ),
                    onPressed: isReady ? () => _onPlayAsset(asset) : null,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOfflineLibraryTab(Map<String, DownloadTask> downloadTasks) {
    final l10n = AppLocalizations.of(context);
    final completedTasks = downloadTasks.values
        .where(
          (t) =>
              t.status == DownloadStatus.completed &&
              !t.id.startsWith('paper_') &&
              !t.id.startsWith('scheme_'),
        )
        .toList();

    if (completedTasks.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.cloud_download_outlined,
              size: 64,
              color: Color(0xFF94A3B8),
            ),
            const SizedBox(height: 16),
            Text(
              l10n?.noOfflineLessons ?? 'No Offline Lessons Downloaded',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: Color(0xFF475569),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              l10n?.noOfflineLessonsDesc ??
                  'Download lessons from the Online tab for zero-data offline studying.',
              style: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: completedTasks.length,
      itemBuilder: (context, index) {
        final task = completedTasks[index];
        final sizeMb = (task.totalBytes / (1024 * 1024)).toStringAsFixed(1);
        final fileExists = File(task.localPath).existsSync();

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: ListTile(
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFECFDF5),
              child: Icon(Icons.offline_bolt_rounded, color: Color(0xFF059669)),
            ),
            title: Text(
              task.title,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Text(
              '$sizeMb MB • AES-CTR Protected${!fileExists ? ' • File missing' : ''}',
              style: const TextStyle(fontSize: 12),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                  tooltip: 'Delete downloaded lesson',
                  onPressed: () async {
                    await DownloadManager.instance.deleteDownloadedFile(
                      task.id,
                    );
                  },
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                  ),
                  onPressed: fileExists
                      ? () {
                          context.push(
                            '/video-player',
                            extra: {
                              'title': task.title,
                              'localFilePath': task.localPath,
                            },
                          );
                        }
                      : null,
                  child: Text(AppLocalizations.of(context)?.play ?? 'Play'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
