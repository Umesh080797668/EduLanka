import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';

class BlogDetailScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> blog;

  const BlogDetailScreen({super.key, required this.blog});

  @override
  ConsumerState<BlogDetailScreen> createState() => _BlogDetailScreenState();
}

class _BlogDetailScreenState extends ConsumerState<BlogDetailScreen> {
  late Map<String, dynamic> _blog;
  List<Map<String, dynamic>> _comments = [];
  bool _isLoading = false;
  String? _myReaction;
  final TextEditingController _commentController = TextEditingController();
  String? _replyingToCommentId;
  String? _replyingToAuthor;

  @override
  void initState() {
    super.initState();
    _blog = Map<String, dynamic>.from(widget.blog);
    _loadBlogDetail();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  String get _blogId => _blog['id']?.toString() ?? '';

  Future<void> _loadBlogDetail() async {
    setState(() => _isLoading = true);
    final localDb = LocalDatabase.instance;

    try {
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.dio.get('/blogs/$_blogId');
      final rawData = res.data;
      final data = rawData is Map && rawData['data'] is Map
          ? Map<String, dynamic>.from(rawData['data'])
          : (rawData is Map ? Map<String, dynamic>.from(rawData) : null);

      if (data != null && mounted) {
        setState(() {
          _blog = data;
          _myReaction = data['myReaction']?.toString();
          if (data['comments'] is List) {
            _comments = List<Map<String, dynamic>>.from(data['comments']);
          }
          _isLoading = false;
        });
      }
    } catch (_) {
      // Offline fallback: load from local SQLite
      final offlineComments = await localDb.getOfflineCommentsForBlog(_blogId);
      final offlineReactions = await localDb.getOfflineReactionsForBlog(
        _blogId,
      );
      final userId = ref.read(authProvider).userId;

      String? reaction;
      for (final r in offlineReactions) {
        if (r['user_id'] == userId) {
          reaction = r['reaction_type']?.toString();
          break;
        }
      }

      if (mounted) {
        setState(() {
          _comments = offlineComments;
          _myReaction = reaction;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _toggleReaction(String type) async {
    final localDb = LocalDatabase.instance;
    final userId = ref.read(authProvider).userId ?? '';
    final isRemoving = _myReaction == type;

    // Optimistic update
    setState(() {
      if (isRemoving) {
        _myReaction = null;
        _blog['likes_count'] =
            ((_blog['likes_count'] as num?)?.toInt() ?? 1) - 1;
      } else {
        if (_myReaction == null) {
          _blog['likes_count'] =
              ((_blog['likes_count'] as num?)?.toInt() ?? 0) + 1;
        }
        _myReaction = type;
      }
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      if (isRemoving) {
        await apiClient.dio.delete('/blogs/$_blogId/reactions');
      } else {
        await apiClient.dio.post(
          '/blogs/$_blogId/reactions',
          data: {'reactionType': type},
        );
      }
    } catch (_) {
      if (isRemoving) {
        await localDb.saveSyncedBlogReaction({
          'id': '${_blogId}_$userId',
          'blog_id': _blogId,
          'user_id': userId,
        }, eventType: 'REMOVED');
      } else {
        // Queue offline reaction in local Drift database & outbox
        await localDb.saveOfflineReaction(
          blogId: _blogId,
          commentId: null,
          userId: userId,
          reactionType: type,
        );
      }
    }
  }

  Future<void> _reportBlog() async {
    final reasonController = TextEditingController();
    final shouldSubmit = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text(
          'Report Article',
          style: TextStyle(color: Colors.white),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Please provide a reason for flagging this article for academic review:',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 3,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText:
                    'e.g. Inappropriate content, plagiarism, incorrect facts...',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF0F172A),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Submit Report'),
          ),
        ],
      ),
    );

    if (shouldSubmit == true && reasonController.text.trim().isNotEmpty) {
      try {
        final apiClient = ref.read(apiClientProvider);
        await apiClient.dio.post(
          '/blogs/$_blogId/report',
          data: {'reason': reasonController.text.trim()},
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Report submitted for review.')),
          );
        }
      } catch (e) {
        if (mounted) {
          String msg = 'Failed to submit report';
          if (e is DioException && e.response?.statusCode == 409) {
            msg = 'You have already reported this blog post.';
          }
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(msg)));
        }
      }
    }
  }

  Future<void> _takedownBlog() async {
    final reasonController = TextEditingController();
    final shouldSubmit = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text(
          'Takedown Article',
          style: TextStyle(color: Colors.white),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Specify administrative justification for unpublishing this article:',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 2,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Takedown reason...',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF0F172A),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orangeAccent,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Take Down'),
          ),
        ],
      ),
    );

    if (shouldSubmit == true) {
      try {
        final apiClient = ref.read(apiClientProvider);
        await apiClient.dio.patch(
          '/blogs/$_blogId/takedown',
          data: {
            'reason': reasonController.text.trim().isEmpty
                ? 'Administrative takedown'
                : reasonController.text.trim(),
          },
        );
        setState(() {
          _blog['is_published'] = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Article taken down and unpublished.'),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Takedown failed: $e')));
        }
      }
    }
  }

  Future<void> _restoreBlog() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text(
          'Restore Article',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'Are you sure you want to restore and republish this blog article?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Restore'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        final apiClient = ref.read(apiClientProvider);
        await apiClient.dio.patch('/blogs/$_blogId/restore');
        setState(() {
          _blog['is_published'] = true;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Article restored successfully.')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Restore failed: $e')));
        }
      }
    }
  }

  Future<void> _submitComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    final auth = ref.read(authProvider);
    final localDb = LocalDatabase.instance;
    final parentId = _replyingToCommentId;

    _commentController.clear();
    setState(() {
      _replyingToCommentId = null;
      _replyingToAuthor = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.dio.post(
        '/blogs/$_blogId/comments',
        data: {'content': text, 'parentId': ?parentId},
      );
      _loadBlogDetail();
    } catch (_) {
      // Queue offline in Drift SQLite
      await localDb.saveOfflineComment(
        blogId: _blogId,
        authorId: auth.userId ?? '',
        authorName: 'EduLanka Member',
        authorRole: auth.role ?? 'STUDENT',
        content: text,
        parentId: parentId,
      );
      _loadBlogDetail();
    }
  }

  Future<void> _moderateComment(
    String commentId, {
    bool? isPinned,
    bool? isHidden,
  }) async {
    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.dio.patch(
        '/blogs/comments/$commentId/moderate',
        data: {'isPinned': ?isPinned, 'isHidden': ?isHidden},
      );
      _loadBlogDetail();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Moderation action failed: $e')));
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

    final title = _blog['title']?.toString() ?? 'Article';
    final authorName = _blog['author_name']?.toString() ?? 'Educator';
    final authorRole = _blog['author_role']?.toString() ?? 'TEACHER';
    final content = _blog['content_markdown']?.toString() ?? '';
    final createdAt = _blog['created_at']?.toString() ?? '';
    final coverImageUrl = _blog['cover_image_url']?.toString();

    List<String> tags = [];
    if (_blog['tags'] is List) {
      tags = List<String>.from(_blog['tags']);
    } else if (_blog['tags'] is String) {
      try {
        final parsed = jsonDecode(_blog['tags']);
        if (parsed is List) tags = List<String>.from(parsed);
      } catch (_) {}
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              if (value == 'report') {
                _reportBlog();
              } else if (value == 'takedown') {
                _takedownBlog();
              } else if (value == 'restore') {
                _restoreBlog();
              }
            },
            itemBuilder: (ctx) {
              final isAdmin =
                  userRole == 'SCHOOL_ADMIN' || userRole == 'SUPER_ADMIN';
              final isPublished = _blog['is_published'] != false;
              return [
                const PopupMenuItem(
                  value: 'report',
                  child: Row(
                    children: [
                      Icon(
                        Icons.flag_outlined,
                        size: 20,
                        color: Colors.amberAccent,
                      ),
                      SizedBox(width: 8),
                      Text('Report Article'),
                    ],
                  ),
                ),
                if (isAdmin && isPublished)
                  const PopupMenuItem(
                    value: 'takedown',
                    child: Row(
                      children: [
                        Icon(
                          Icons.shield_outlined,
                          size: 20,
                          color: Colors.orangeAccent,
                        ),
                        SizedBox(width: 8),
                        Text('Takedown Article'),
                      ],
                    ),
                  ),
                if (isAdmin && !isPublished)
                  const PopupMenuItem(
                    value: 'restore',
                    child: Row(
                      children: [
                        Icon(
                          Icons.restore_outlined,
                          size: 20,
                          color: Colors.greenAccent,
                        ),
                        SizedBox(width: 8),
                        Text('Restore Article'),
                      ],
                    ),
                  ),
              ];
            },
          ),
        ],
      ),
      body: Container(
        color: const Color(0xFF0F172A),
        child: Column(
          children: [
            if (_isLoading)
              const LinearProgressIndicator(
                color: Color(0xFF38BDF8),
                backgroundColor: Color(0xFF1E293B),
              ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (coverImageUrl != null && coverImageUrl.isNotEmpty)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.network(
                          coverImageUrl,
                          height: 180,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const SizedBox.shrink(),
                        ),
                      ),
                    const SizedBox(height: 12),
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 14,
                          backgroundColor: const Color(0xFF0284C7),
                          child: Text(
                            authorName.isNotEmpty
                                ? authorName[0].toUpperCase()
                                : 'E',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          authorName,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            authorRole,
                            style: const TextStyle(
                              color: Color(0xFF38BDF8),
                              fontSize: 11,
                            ),
                          ),
                        ),
                        const Spacer(),
                        if (createdAt.isNotEmpty)
                          Text(
                            createdAt.length >= 10
                                ? createdAt.substring(0, 10)
                                : createdAt,
                            style: const TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 12,
                            ),
                          ),
                      ],
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
                    const SizedBox(height: 16),
                    const Divider(color: Color(0xFF334155)),
                    const SizedBox(height: 12),
                    // Markdown content display
                    Text(
                      content,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        height: 1.6,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Divider(color: Color(0xFF334155)),
                    // Academic Reactions Bar
                    _buildReactionsBar(),
                    const SizedBox(height: 24),
                    // Discourse Comment Section Header
                    Row(
                      children: [
                        const Icon(
                          Icons.forum,
                          color: Color(0xFF34D399),
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Academic Discussions (${_comments.length})',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Comments and Threaded Replies Tree
                    if (_comments.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            'No comments yet. Start the academic discourse below!',
                            style: const TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 14,
                            ),
                          ),
                        ),
                      )
                    else
                      ..._comments.map(
                        (c) => _buildCommentTile(c, isTeacherOrAdmin),
                      ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
            // Comment Composer
            _buildCommentComposer(),
          ],
        ),
      ),
    );
  }

  Widget _buildReactionsBar() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildReactionButton('LIKE', '👍 Like'),
          _buildReactionButton('HELPFUL', '💡 Helpful'),
          _buildReactionButton('INSIGHTFUL', '🧠 Insightful'),
          _buildReactionButton('HEART', '❤️ Heart'),
        ],
      ),
    );
  }

  Widget _buildReactionButton(String type, String label) {
    final isActive = _myReaction == type;
    return InkWell(
      onTap: () => _toggleReaction(type),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isActive
              ? const Color(0xFF0284C7).withValues(alpha: 0.3)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isActive ? const Color(0xFF38BDF8) : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? const Color(0xFF38BDF8) : Colors.white70,
            fontSize: 13,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _buildCommentTile(
    Map<String, dynamic> comment,
    bool isTeacherOrAdmin,
  ) {
    final authorName = comment['author_name']?.toString() ?? 'Member';
    final authorRole = comment['author_role']?.toString() ?? 'STUDENT';
    final content = comment['content']?.toString() ?? '';
    final isPinned = comment['is_pinned'] == 1 || comment['is_pinned'] == true;
    final replies = comment['replies'] is List
        ? comment['replies'] as List
        : [];
    final commentId = comment['id']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isPinned ? const Color(0xFFF59E0B) : const Color(0xFF334155),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: authorRole == 'TEACHER'
                    ? const Color(0xFF0284C7)
                    : const Color(0xFF10B981),
                child: Text(
                  authorName.isNotEmpty ? authorName[0].toUpperCase() : 'M',
                  style: const TextStyle(color: Colors.white, fontSize: 11),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                authorName,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  authorRole,
                  style: TextStyle(
                    color: authorRole == 'TEACHER'
                        ? const Color(0xFF38BDF8)
                        : const Color(0xFF34D399),
                    fontSize: 9,
                  ),
                ),
              ),
              if (isPinned) ...[
                const SizedBox(width: 6),
                const Icon(Icons.push_pin, size: 14, color: Color(0xFFF59E0B)),
                const Text(
                  ' Pinned',
                  style: TextStyle(
                    color: Color(0xFFF59E0B),
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
              const Spacer(),
              if (isTeacherOrAdmin)
                PopupMenuButton<String>(
                  icon: const Icon(
                    Icons.more_vert,
                    size: 16,
                    color: Colors.white70,
                  ),
                  color: const Color(0xFF1E293B),
                  onSelected: (val) {
                    if (val == 'pin') {
                      _moderateComment(commentId, isPinned: !isPinned);
                    } else if (val == 'hide') {
                      _moderateComment(commentId, isHidden: true);
                    }
                  },
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: 'pin',
                      child: Text(
                        isPinned ? 'Unpin Answer' : 'Pin Insightful Answer',
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'hide',
                      child: Text(
                        'Hide Comment',
                        style: TextStyle(color: Colors.redAccent),
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: const TextStyle(color: Colors.white, fontSize: 13),
          ),
          const SizedBox(height: 8),
          InkWell(
            onTap: () {
              setState(() {
                _replyingToCommentId = commentId;
                _replyingToAuthor = authorName;
              });
            },
            child: const Text(
              'Reply',
              style: TextStyle(
                color: Color(0xFF38BDF8),
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          // Nested replies
          if (replies.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 16, top: 10),
              child: Column(
                children: replies
                    .map((r) => _buildCommentTile(r, isTeacherOrAdmin))
                    .toList(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCommentComposer() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: Color(0xFF1E293B),
        border: Border(top: BorderSide(color: Color(0xFF334155))),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_replyingToAuthor != null)
              Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    Text(
                      'Replying to @$_replyingToAuthor',
                      style: const TextStyle(
                        color: Color(0xFF38BDF8),
                        fontSize: 12,
                      ),
                    ),
                    const Spacer(),
                    InkWell(
                      onTap: () => setState(() {
                        _replyingToCommentId = null;
                        _replyingToAuthor = null;
                      }),
                      child: const Icon(
                        Icons.close,
                        size: 16,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: _replyingToAuthor != null
                          ? 'Write a reply...'
                          : 'Join academic discussion...',
                      hintStyle: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 14,
                      ),
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xFF334155)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xFF334155)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xFF0284C7)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _submitComment,
                  icon: const Icon(Icons.send, color: Color(0xFF38BDF8)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
