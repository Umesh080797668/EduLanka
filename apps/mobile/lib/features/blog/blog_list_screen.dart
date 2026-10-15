import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';

class BlogListScreen extends ConsumerStatefulWidget {
  const BlogListScreen({super.key});

  @override
  ConsumerState<BlogListScreen> createState() => _BlogListScreenState();
}

class _BlogListScreenState extends ConsumerState<BlogListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = false;
  List<Map<String, dynamic>> _blogs = [];
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        _loadBlogs();
      }
    });
    _loadBlogs();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _currentScope() {
    switch (_tabController.index) {
      case 0:
        return 'SCHOOL';
      case 1:
        return 'CLASS';
      case 2:
      default:
        return 'PLATFORM';
    }
  }

  Future<void> _loadBlogs() async {
    setState(() {
      _isLoading = true;
    });

    final scope = _currentScope();
    final localDb = LocalDatabase.instance;

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.dio.get(
        '/blogs',
        queryParameters: {'scope': scope},
      );

      final rawData = response.data;
      List<Map<String, dynamic>> items = [];
      if (rawData is Map && rawData['data'] is List) {
        items = List<Map<String, dynamic>>.from(rawData['data']);
      } else if (rawData is List) {
        items = List<Map<String, dynamic>>.from(rawData);
      }

      // Cache locally in Drift SQLite
      for (final item in items) {
        await localDb.saveSyncedBlogPost(item);
      }

      if (mounted) {
        setState(() {
          _blogs = items;
          _isLoading = false;
          _isOffline = false;
        });
      }
    } catch (_) {
      // Offline fallback: load from Drift database
      final offlineItems = await localDb.getOfflineBlogs(scope: scope);
      if (mounted) {
        setState(() {
          _blogs = offlineItems;
          _isLoading = false;
          _isOffline = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final userRole = ref.watch(authProvider).role;
    final isTeacherOrAdmin =
        userRole == 'TEACHER' ||
        userRole == 'SCHOOL_ADMIN' ||
        userRole == 'SUPER_ADMIN';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Academic Blogs & Discourse'),
        elevation: 0,
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF38BDF8),
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(icon: Icon(Icons.school, size: 20), text: 'School'),
            Tab(icon: Icon(Icons.class_, size: 20), text: 'Class'),
            Tab(icon: Icon(Icons.public, size: 20), text: 'National'),
          ],
        ),
      ),
      body: Container(
        color: const Color(0xFF0F172A),
        child: Column(
          children: [
            if (_isOffline)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  vertical: 8,
                  horizontal: 16,
                ),
                color: Colors.amber.shade900,
                child: const Row(
                  children: [
                    Icon(Icons.wifi_off, color: Colors.white, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Viewing offline cached educational blogs',
                        style: TextStyle(color: Colors.white, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadBlogs,
                color: const Color(0xFF38BDF8),
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFF38BDF8),
                        ),
                      )
                    : _blogs.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.menu_book,
                              size: 64,
                              color: const Color(0xFF475569),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No ${_currentScope().toLowerCase()} blogs published yet',
                              style: const TextStyle(
                                color: Color(0xFF94A3B8),
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _blogs.length,
                        itemBuilder: (context, index) {
                          final blog = _blogs[index];
                          return _buildBlogCard(blog);
                        },
                      ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: isTeacherOrAdmin
          ? FloatingActionButton.extended(
              onPressed: () async {
                final created = await context.push('/blogs/create');
                if (created == true) {
                  _loadBlogs();
                }
              },
              backgroundColor: const Color(0xFF0284C7),
              icon: const Icon(Icons.edit, color: Colors.white),
              label: const Text(
                'Author Article',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildBlogCard(Map<String, dynamic> blog) {
    final title = blog['title']?.toString() ?? 'Untitled Article';
    final authorName = blog['author_name']?.toString() ?? 'Educator';
    final authorRole = blog['author_role']?.toString() ?? 'TEACHER';
    final likesCount = (blog['likes_count'] as num?)?.toInt() ?? 0;
    final commentsCount = (blog['comments_count'] as num?)?.toInt() ?? 0;
    final isPinned = blog['is_pinned'] == 1 || blog['is_pinned'] == true;
    final contentMarkdown = blog['content_markdown']?.toString() ?? '';
    final preview = contentMarkdown.length > 140
        ? '${contentMarkdown.substring(0, 140)}...'
        : contentMarkdown;

    List<String> tags = [];
    if (blog['tags'] is List) {
      tags = List<String>.from(blog['tags']);
    } else if (blog['tags'] is String) {
      try {
        final parsed = jsonDecode(blog['tags']);
        if (parsed is List) tags = List<String>.from(parsed);
      } catch (_) {}
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      color: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isPinned ? const Color(0xFFF59E0B) : const Color(0xFF334155),
          width: isPinned ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          context.push('/blogs/detail', extra: blog);
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isPinned)
                Row(
                  children: const [
                    Icon(Icons.push_pin, size: 16, color: Color(0xFFF59E0B)),
                    SizedBox(width: 4),
                    Text(
                      'PINNED ARTICLE',
                      style: TextStyle(
                        color: Color(0xFFF59E0B),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              if (isPinned) const SizedBox(height: 8),
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: const Color(0xFF0284C7),
                    child: Text(
                      authorName.isNotEmpty ? authorName[0].toUpperCase() : 'E',
                      style: const TextStyle(fontSize: 12, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    authorName,
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      authorRole,
                      style: const TextStyle(
                        color: Color(0xFF38BDF8),
                        fontSize: 10,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                preview,
                style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
              ),
              if (tags.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: tags.map((t) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF334155),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '#$t',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
              const SizedBox(height: 12),
              const Divider(color: Color(0xFF334155), height: 1),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.thumb_up_alt_outlined,
                        size: 16,
                        color: Color(0xFF38BDF8),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '$likesCount reactions',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      const Icon(
                        Icons.forum_outlined,
                        size: 16,
                        color: Color(0xFF34D399),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '$commentsCount comments',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
