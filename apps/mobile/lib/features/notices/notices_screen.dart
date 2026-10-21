import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/database/local_database.dart';
import '../../l10n/app_localizations.dart';

class NoticesScreen extends ConsumerStatefulWidget {
  const NoticesScreen({super.key});

  @override
  ConsumerState<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends ConsumerState<NoticesScreen> {
  bool _isLoading = false;
  bool _isOffline = false;
  List<Map<String, dynamic>> _notices = [];
  String _searchQuery = '';
  String _selectedPriority = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadNotices();
  }

  Future<void> _loadNotices() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final remoteNotices = await ref.read(apiClientProvider).getNotices();
      if (mounted) {
        setState(() {
          _notices = remoteNotices;
          _isOffline = false;
        });
      }
      // Cache for offline access
      await LocalDatabase.instance.saveSyncMetadata(
        'cached_notices',
        jsonEncode(remoteNotices),
      );
    } catch (_) {
      // Offline fallback: load from cached metadata in SQLite
      final cachedJson = await LocalDatabase.instance.getSyncMetadata(
        'cached_notices',
      );
      if (cachedJson != null && cachedJson.isNotEmpty) {
        try {
          final decoded = jsonDecode(cachedJson);
          if (decoded is List) {
            final cachedList = decoded
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
            if (mounted) {
              setState(() {
                _notices = cachedList;
                _isOffline = true;
              });
            }
          }
        } catch (_) {}
      } else {
        if (mounted) {
          setState(() {
            _isOffline = true;
          });
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filteredNotices {
    return _notices.where((notice) {
      final priority = (notice['priority']?.toString() ?? 'NORMAL')
          .toUpperCase();
      if (_selectedPriority == 'EMERGENCY' &&
          priority != 'EMERGENCY' &&
          priority != 'HIGH') {
        return false;
      }
      if (_selectedPriority == 'NORMAL' &&
          (priority == 'EMERGENCY' || priority == 'HIGH')) {
        return false;
      }

      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final title = (notice['title']?.toString() ?? '').toLowerCase();
        final content = (notice['content']?.toString() ?? '').toLowerCase();
        if (!title.contains(q) && !content.contains(q)) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  Color _getPriorityColor(String priority) {
    switch (priority.toUpperCase()) {
      case 'EMERGENCY':
        return const Color(0xFFEF4444);
      case 'HIGH':
        return const Color(0xFFF59E0B);
      case 'NORMAL':
      default:
        return const Color(0xFF3B82F6);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final filtered = _filteredNotices;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.announcements ?? 'School Notices'),
        backgroundColor: const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: l10n?.refresh ?? 'Refresh',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _isLoading ? null : _loadNotices,
          ),
        ],
      ),
      body: Column(
        children: [
          // Offline banner if loaded from cache
          if (_isOffline)
            Container(
              color: const Color(0xFFFEF3C7),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Icon(
                    Icons.cloud_off_rounded,
                    color: Color(0xFFD97706),
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n?.offlineAlert ??
                          'Offline Mode — Viewing cached notices.',
                      style: const TextStyle(
                        color: Color(0xFF92400E),
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Search and filter bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: l10n?.search ?? 'Search notices...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                    ),
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val;
                      });
                    },
                  ),
                ),
              ],
            ),
          ),

          // Priority filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                ChoiceChip(
                  label: Text(l10n?.allNotices ?? 'All Notices'),
                  selected: _selectedPriority == 'ALL',
                  onSelected: (selected) {
                    if (selected) setState(() => _selectedPriority = 'ALL');
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text(l10n?.urgentAndEmergency ?? 'Urgent & Emergency'),
                  selected: _selectedPriority == 'EMERGENCY',
                  selectedColor: const Color(0xFFFEE2E2),
                  onSelected: (selected) {
                    if (selected) {
                      setState(() => _selectedPriority = 'EMERGENCY');
                    }
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text(l10n?.regularNotices ?? 'Regular Notices'),
                  selected: _selectedPriority == 'NORMAL',
                  onSelected: (selected) {
                    if (selected) setState(() => _selectedPriority = 'NORMAL');
                  },
                ),
              ],
            ),
          ),
          const Divider(height: 16),

          // List of notices
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.notifications_none_rounded,
                          size: 48,
                          color: Color(0xFF94A3B8),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          l10n?.announcements ?? 'No notices found',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n?.circularsAppearHere ??
                              'When school administration posts circulars, they will appear here.',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _loadNotices,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: filtered.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final notice = filtered[index];
                        final title = notice['title']?.toString() ?? 'Notice';
                        final content = notice['content']?.toString() ?? '';
                        final priority =
                            (notice['priority']?.toString() ?? 'NORMAL')
                                .toUpperCase();
                        final scope =
                            (notice['target_scope']?.toString() ??
                                    'ALL_STUDENTS')
                                .toUpperCase();
                        final createdAtRaw = notice['created_at']?.toString();
                        final formattedDate = createdAtRaw != null
                            ? DateFormat.yMMMd().add_jm().format(
                                DateTime.parse(createdAtRaw).toLocal(),
                              )
                            : '';
                        final priorityColor = _getPriorityColor(priority);

                        return Card(
                          elevation: priority == 'EMERGENCY' ? 2 : 1,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: priority == 'EMERGENCY'
                                  ? const Color(0xFFEF4444)
                                  : const Color(0xFFE2E8F0),
                              width: priority == 'EMERGENCY' ? 1.5 : 1,
                            ),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: priorityColor.withValues(
                                          alpha: 0.12,
                                        ),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        priority,
                                        style: TextStyle(
                                          color: priorityColor,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF1F5F9),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        scope.replaceAll('_', ' '),
                                        style: const TextStyle(
                                          color: Color(0xFF475569),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                    const Spacer(),
                                    if (formattedDate.isNotEmpty)
                                      Text(
                                        formattedDate,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF94A3B8),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  title,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: priority == 'EMERGENCY'
                                        ? const Color(0xFFDC2626)
                                        : const Color(0xFF1E293B),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  content,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFF334155),
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
