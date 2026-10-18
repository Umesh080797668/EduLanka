import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import 'package:file_picker/file_picker.dart';
import '../../core/database/local_database.dart';
import '../../l10n/app_localizations.dart';
import '../tutorial/tutorial_engine.dart';

class HomeworkScreen extends ConsumerStatefulWidget {
  const HomeworkScreen({super.key});

  @override
  ConsumerState<HomeworkScreen> createState() => _HomeworkScreenState();
}

class _HomeworkScreenState extends ConsumerState<HomeworkScreen> {
  bool _isLoading = false;
  List<dynamic> _tasks = [];

  @override
  void initState() {
    super.initState();
    _loadHomeworkTasks();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'phase3_offline_homework');
    });
  }

  Future<void> _loadHomeworkTasks() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final remoteTasks = await apiClient.getHomeworkTasks();
      if (remoteTasks.isNotEmpty) {
        await LocalDatabase.instance.saveOfflineHomeworkTasks(remoteTasks);
        if (mounted) setState(() => _tasks = remoteTasks);
      } else {
        final offlineTasks = await LocalDatabase.instance
            .getOfflineHomeworkTasks();
        if (mounted) setState(() => _tasks = offlineTasks);
      }
    } catch (_) {
      // Offline fallback: load from local SQLite
      final offlineTasks = await LocalDatabase.instance
          .getOfflineHomeworkTasks();
      if (mounted) setState(() => _tasks = offlineTasks);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openAssignHomeworkDialog() async {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    final attachmentController = TextEditingController();
    final List<Map<String, dynamic>> attachments = [];
    DateTime selectedDate = DateTime.now().add(const Duration(days: 3));

    bool isUploading = false;
    List<Map<String, dynamic>> classesList = [
      {
        'id': 'a1111111-1111-1111-1111-111111111111',
        'name': 'Grade 10 - Section A',
      },
      {
        'id': 'a2222222-2222-2222-2222-222222222222',
        'name': 'Grade 11 - Section B',
      },
    ];
    try {
      final remoteClasses = await ref.read(apiClientProvider).getClasses();
      if (remoteClasses.isNotEmpty) {
        classesList = remoteClasses.map((c) {
          final grade = c['grade'] ?? '';
          final sec = c['section'] ?? '';
          return {
            'id': c['id']?.toString() ?? '',
            'name': 'Grade $grade - Section $sec',
          };
        }).toList();
      }
    } catch (_) {}

    String selectedClassId = classesList.first['id'] as String;

    if (!mounted) return;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final l10n = AppLocalizations.of(ctx);
          return AlertDialog(
            title: Row(
              children: [
                const Icon(Icons.edit_note_rounded, color: Color(0xFF0D9488)),
                const SizedBox(width: 8),
                Text(l10n?.assignHomework ?? 'Assign New Homework'),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: titleController,
                    decoration: const InputDecoration(
                      labelText: 'Homework Title',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: descController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Instructions / Problems',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: selectedClassId,
                    decoration: const InputDecoration(
                      labelText: 'Target Class',
                      border: OutlineInputBorder(),
                    ),
                    items: classesList.map((c) {
                      return DropdownMenuItem<String>(
                        value: c['id'] as String,
                        child: Text(c['name'] as String),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() => selectedClassId = val);
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.calendar_today_rounded,
                      color: Color(0xFF0D9488),
                    ),
                    title: Text(
                      'Due: ${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}',
                    ),
                    trailing: TextButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: selectedDate,
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(
                            const Duration(days: 90),
                          ),
                        );
                        if (picked != null) {
                          setDialogState(() => selectedDate = picked);
                        }
                      },
                      child: Text(l10n?.change ?? 'Change'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Attachments / Learning Materials',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: isUploading
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.attach_file, size: 18),
                          label: Text(
                            isUploading
                                ? 'Uploading to cloud...'
                                : 'Browse Device Files',
                          ),
                          onPressed: isUploading
                              ? null
                              : () async {
                                  final result = await FilePicker.platform
                                      .pickFiles(
                                        allowMultiple: true,
                                        type: FileType.custom,
                                        allowedExtensions: [
                                          'jpg',
                                          'jpeg',
                                          'png',
                                          'webp',
                                          'pdf',
                                        ],
                                      );
                                  if (result != null &&
                                      result.files.isNotEmpty) {
                                    setDialogState(() => isUploading = true);
                                    final apiClient = ref.read(
                                      apiClientProvider,
                                    );
                                    for (final f in result.files) {
                                      String attachmentUrl = f.name;
                                      if (f.path != null &&
                                          File(f.path!).existsSync()) {
                                        try {
                                          attachmentUrl = await apiClient
                                              .uploadAttachment(
                                                filePath: f.path!,
                                                fileName: f.name,
                                              );
                                        } catch (e) {
                                          if (ctx.mounted) {
                                            ScaffoldMessenger.of(
                                              ctx,
                                            ).showSnackBar(
                                              SnackBar(
                                                content: Text(
                                                  'Failed to upload ${f.name}: $e',
                                                ),
                                              ),
                                            );
                                          }
                                          continue;
                                        }
                                      }
                                      attachments.add({
                                        'name': f.name,
                                        'url': attachmentUrl,
                                        'size': f.size,
                                        'type':
                                            f.extension != null &&
                                                ['jpg', 'jpeg', 'png'].contains(
                                                  f.extension!.toLowerCase(),
                                                )
                                            ? 'image'
                                            : 'document',
                                      });
                                    }
                                    setDialogState(() => isUploading = false);
                                  }
                                },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: attachmentController,
                          decoration: const InputDecoration(
                            hintText: 'Or enter Worksheet URL / Link',
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(
                          Icons.add_circle,
                          color: Color(0xFF0D9488),
                        ),
                        tooltip: 'Add Link',
                        onPressed: () {
                          final val = attachmentController.text.trim();
                          if (val.isNotEmpty) {
                            setDialogState(() {
                              attachments.add({
                                'name': val,
                                'url': val,
                                'type': val.endsWith('.pdf') ? 'pdf' : 'doc',
                              });
                              attachmentController.clear();
                            });
                          }
                        },
                      ),
                    ],
                  ),
                  if (attachments.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: attachments.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final att = entry.value;
                        return Chip(
                          avatar: const Icon(Icons.attach_file, size: 16),
                          label: Text(att['name']?.toString() ?? 'File'),
                          onDeleted: () {
                            setDialogState(() => attachments.removeAt(idx));
                          },
                        );
                      }).toList(),
                    ),
                  ],
                ],
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
                onPressed: isUploading
                    ? null
                    : () async {
                        final title = titleController.text.trim();
                        final desc = descController.text.trim();
                        if (title.isEmpty) return;

                        final apiClient = ref.read(apiClientProvider);
                        try {
                          await apiClient.createHomeworkTask({
                            'classId': selectedClassId,
                            'title': title,
                            'description': desc,
                            'dueDate': selectedDate.toUtc().toIso8601String(),
                            'attachments': attachments,
                          });
                          if (ctx.mounted) Navigator.of(ctx).pop();
                          await _loadHomeworkTasks();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Homework assigned and published.',
                                ),
                                backgroundColor: Color(0xFF10B981),
                              ),
                            );
                          }
                        } catch (e) {
                          // Fallback: save offline
                          await LocalDatabase.instance.saveOfflineHomeworkTasks(
                            [
                              {
                                'id': const Uuid().v4(),
                                'classId': selectedClassId,
                                'title': title,
                                'description': desc,
                                'dueDate': selectedDate
                                    .toUtc()
                                    .toIso8601String(),
                                'attachments': attachments,
                              },
                            ],
                          );
                          if (ctx.mounted) Navigator.of(ctx).pop();
                          await _loadHomeworkTasks();
                        }
                      },
                child: Text(
                  isUploading ? 'Uploading...' : (l10n?.publish ?? 'Publish'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _openSubmitHomeworkDialog(Map<String, dynamic> task) async {
    final contentController = TextEditingController();
    final attachmentController = TextEditingController();
    final List<Map<String, dynamic>> solutionAttachments = [];
    bool isUploading = false;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final l10n = AppLocalizations.of(ctx);
          return AlertDialog(
            title: Text('${l10n?.submit ?? 'Submit'}: ${task['title']}'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task['description']?.toString() ?? '',
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: contentController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Your Solution / Answer',
                      border: OutlineInputBorder(),
                      hintText: 'Type your completed homework text...',
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Attach Solution Files / Photos',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: isUploading
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.upload_file, size: 18),
                          label: Text(
                            isUploading
                                ? 'Uploading to cloud...'
                                : 'Pick Solution Files / Photos',
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFEFF6FF),
                            foregroundColor: const Color(0xFF1E40AF),
                            elevation: 0,
                          ),
                          onPressed: isUploading
                              ? null
                              : () async {
                                  final result = await FilePicker.platform
                                      .pickFiles(
                                        allowMultiple: true,
                                        type: FileType.custom,
                                        allowedExtensions: [
                                          'jpg',
                                          'jpeg',
                                          'png',
                                          'webp',
                                          'pdf',
                                        ],
                                      );
                                  if (result != null &&
                                      result.files.isNotEmpty) {
                                    setDialogState(() => isUploading = true);
                                    final apiClient = ref.read(
                                      apiClientProvider,
                                    );
                                    final appDir =
                                        await getApplicationDocumentsDirectory();
                                    final offDir = Directory(
                                      p.join(
                                        appDir.path,
                                        'offline_homework_attachments',
                                      ),
                                    );
                                    if (!await offDir.exists()) {
                                      await offDir.create(recursive: true);
                                    }

                                    for (final f in result.files) {
                                      if (f.path == null) continue;
                                      final origFile = File(f.path!);
                                      if (!origFile.existsSync()) continue;

                                      final localCopyPath = p.join(
                                        offDir.path,
                                        '${const Uuid().v4()}_${f.name}',
                                      );
                                      await origFile.copy(localCopyPath);

                                      String attachmentUrl = '';
                                      try {
                                        attachmentUrl = await apiClient
                                            .uploadAttachment(
                                              filePath: localCopyPath,
                                              fileName: f.name,
                                            );
                                      } catch (e) {
                                        // Offline or network error: queued locally for background sync
                                        if (ctx.mounted) {
                                          ScaffoldMessenger.of(
                                            ctx,
                                          ).showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                '${f.name} cached locally. Will upload during sync.',
                                              ),
                                              duration: const Duration(
                                                seconds: 2,
                                              ),
                                            ),
                                          );
                                        }
                                      }

                                      solutionAttachments.add({
                                        'name': f.name,
                                        'url': attachmentUrl,
                                        'localPath': localCopyPath,
                                        'size': f.size,
                                        'type':
                                            f.extension != null &&
                                                [
                                                  'jpg',
                                                  'jpeg',
                                                  'png',
                                                  'webp',
                                                ].contains(
                                                  f.extension!.toLowerCase(),
                                                )
                                            ? 'image'
                                            : 'document',
                                      });
                                    }
                                    setDialogState(() => isUploading = false);
                                  }
                                },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: attachmentController,
                          decoration: const InputDecoration(
                            hintText: 'Or paste file / document link',
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(
                          Icons.add_circle,
                          color: Color(0xFF1E40AF),
                        ),
                        tooltip: 'Add Link',
                        onPressed: () {
                          final val = attachmentController.text.trim();
                          if (val.isNotEmpty) {
                            setDialogState(() {
                              solutionAttachments.add({
                                'name': val,
                                'url': val,
                                'type':
                                    val.endsWith('.jpg') || val.endsWith('.png')
                                    ? 'image'
                                    : 'file',
                              });
                              attachmentController.clear();
                            });
                          }
                        },
                      ),
                    ],
                  ),
                  if (solutionAttachments.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: solutionAttachments.asMap().entries.map((
                        entry,
                      ) {
                        final idx = entry.key;
                        final att = entry.value;
                        return Chip(
                          avatar: const Icon(Icons.attach_file, size: 16),
                          label: Text(att['name']?.toString() ?? 'File'),
                          onDeleted: () {
                            setDialogState(
                              () => solutionAttachments.removeAt(idx),
                            );
                          },
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: Text(l10n?.cancel ?? 'Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E40AF),
                  foregroundColor: Colors.white,
                ),
                onPressed: isUploading
                    ? null
                    : () async {
                        final content = contentController.text.trim();
                        if (content.isEmpty && solutionAttachments.isEmpty) {
                          return;
                        }

                        final auth = ref.read(authProvider);
                        final taskId = task['id']?.toString() ?? '';
                        final studentId = auth.userId ?? '';
                        final clientUuid = const Uuid().v4();

                        try {
                          final apiClient = ref.read(apiClientProvider);
                          final sanitizedAttachments = solutionAttachments.map((
                            a,
                          ) {
                            final copy = Map<String, dynamic>.from(a);
                            copy.remove('path');
                            copy.remove('localPath');
                            return copy;
                          }).toList();
                          await apiClient.submitHomework(taskId, {
                            'content': content,
                            'attachments': sanitizedAttachments,
                            'clientUuid': clientUuid,
                          });
                          if (ctx.mounted) Navigator.of(ctx).pop();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Homework submitted successfully!',
                                ),
                                backgroundColor: Color(0xFF10B981),
                              ),
                            );
                          }
                        } catch (_) {
                          // Queue into offline SQLite outbox (ADR-002)
                          await LocalDatabase.instance.recordHomeworkSubmission(
                            homeworkId: taskId,
                            studentId: studentId,
                            content: content,
                            attachments: solutionAttachments,
                            clientUuid: clientUuid,
                          );
                          if (ctx.mounted) Navigator.of(ctx).pop();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Homework queued in offline outbox. Will sync when online.',
                                ),
                                backgroundColor: Color(0xFFF59E0B),
                              ),
                            );
                          }
                        }
                        await _loadHomeworkTasks();
                      },
                child: Text(
                  isUploading ? 'Uploading...' : (l10n?.submit ?? 'Submit'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _viewSubmissionsDialog(Map<String, dynamic> task) async {
    final taskId = task['id']?.toString() ?? '';
    final apiClient = ref.read(apiClientProvider);
    List<dynamic> submissions = [];

    try {
      submissions = await apiClient.getHomeworkSubmissions(taskId);
    } catch (_) {}

    if (!mounted) return;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (ctx, scrollController) {
          final l10n = AppLocalizations.of(ctx);
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${l10n?.submissions ?? 'Submissions'}: ${task['title']}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
                const Divider(),
                if (submissions.isEmpty)
                  Expanded(
                    child: Center(
                      child: Text(
                        l10n?.noSubmissions ??
                            'No submissions received yet for this task.',
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.builder(
                      controller: scrollController,
                      itemCount: submissions.length,
                      itemBuilder: (ctx, index) {
                        final sub = submissions[index] as Map<String, dynamic>;
                        final studentUser =
                            sub['users'] as Map<String, dynamic>?;
                        final studentName =
                            studentUser?['full_name'] ?? 'Student';
                        final grade = sub['grade']?.toString();
                        final content = sub['content']?.toString() ?? '';

                        final rawSubAtts = sub['attachments'];
                        List subAtts = [];
                        if (rawSubAtts is String && rawSubAtts.isNotEmpty) {
                          try {
                            final decoded = jsonDecode(rawSubAtts);
                            if (decoded is List) subAtts = decoded;
                          } catch (_) {}
                        } else if (rawSubAtts is List) {
                          subAtts = rawSubAtts;
                        }

                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            title: Text(studentName),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(content),
                                if (subAtts.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Wrap(
                                    spacing: 4,
                                    children: subAtts.map((att) {
                                      final name =
                                          (att is Map ? att['name'] : att)
                                              ?.toString() ??
                                          'File';
                                      return Chip(
                                        visualDensity: VisualDensity.compact,
                                        avatar: const Icon(
                                          Icons.attach_file,
                                          size: 12,
                                        ),
                                        label: Text(
                                          name,
                                          style: const TextStyle(fontSize: 10),
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ],
                              ],
                            ),
                            trailing: grade != null
                                ? Chip(
                                    label: Text(grade),
                                    backgroundColor: const Color(0xFFD1FAE5),
                                  )
                                : ElevatedButton(
                                    onPressed: () => _openGradingDialog(
                                      sub['id']?.toString() ?? '',
                                    ),
                                    child: Text(
                                      AppLocalizations.of(context)?.grade ??
                                          'Grade',
                                    ),
                                  ),
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _openGradingDialog(String submissionId) async {
    final gradeController = TextEditingController(text: 'A');
    final feedbackController = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) {
        final l10n = AppLocalizations.of(ctx);
        return AlertDialog(
          title: Text(l10n?.gradeSubmission ?? 'Grade Submission'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: gradeController,
                decoration: const InputDecoration(
                  labelText: 'Grade (e.g. A, B+, 90/100)',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: feedbackController,
                decoration: const InputDecoration(
                  labelText: 'Teacher Feedback',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(l10n?.cancel ?? 'Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final grade = gradeController.text.trim();
                final feedback = feedbackController.text.trim();
                if (grade.isEmpty) return;

                try {
                  final apiClient = ref.read(apiClientProvider);
                  await apiClient.gradeHomeworkSubmission(submissionId, {
                    'grade': grade,
                    'feedback': feedback,
                    'status': 'GRADED',
                  });
                  if (ctx.mounted) Navigator.of(ctx).pop();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Grade saved successfully.'),
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to save grade: $e')),
                    );
                  }
                }
              },
              child: Text(l10n?.save ?? 'Save Grade'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final isTeacher = auth.role == 'TEACHER' || auth.role == 'SCHOOL_ADMIN';
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.homeworkTasks ?? 'Homework & Assignments'),
        backgroundColor: isTeacher
            ? const Color(0xFF0D9488)
            : const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
      ),
      floatingActionButton: isTeacher
          ? FloatingActionButton.extended(
              backgroundColor: const Color(0xFF0D9488),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: Text(l10n?.assignHomework ?? 'Assign Homework'),
              onPressed: _openAssignHomeworkDialog,
            )
          : null,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadHomeworkTasks,
              child: _tasks.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.assignment_outlined,
                            size: 64,
                            color: Colors.grey.shade400,
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'No homework assigned right now.',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _tasks.length,
                      itemBuilder: (ctx, index) {
                        final task = _tasks[index] is Map
                            ? _tasks[index] as Map<String, dynamic>
                            : <String, dynamic>{};
                        final title = task['title']?.toString() ?? 'Task';
                        final desc = task['description']?.toString() ?? '';
                        final dueDate =
                            task['due_date']?.toString() ??
                            task['dueDate']?.toString() ??
                            '';
                        final mySub =
                            task['mySubmission'] as Map<String, dynamic>?;
                        final isSubmitted = mySub != null;
                        final grade = mySub?['grade']?.toString();

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        title,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ),
                                    if (isSubmitted)
                                      Chip(
                                        label: Text(
                                          grade != null
                                              ? 'Graded: $grade'
                                              : 'Submitted',
                                        ),
                                        backgroundColor: grade != null
                                            ? const Color(0xFFD1FAE5)
                                            : const Color(0xFFDBEAFE),
                                      )
                                    else if (!isTeacher)
                                      Chip(
                                        label: Text(l10n?.pending ?? 'Pending'),
                                        backgroundColor:
                                            const Color(0xFFFEF3C7),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  desc,
                                  style: const TextStyle(
                                    color: Color(0xFF475569),
                                  ),
                                ),
                                Builder(
                                  builder: (ctx) {
                                    final rawAtts = task['attachments'];
                                    List taskAtts = [];
                                    if (rawAtts is String &&
                                        rawAtts.isNotEmpty) {
                                      try {
                                        final decoded = jsonDecode(rawAtts);
                                        if (decoded is List) {
                                          taskAtts = decoded;
                                        }
                                      } catch (_) {}
                                    } else if (rawAtts is List) {
                                      taskAtts = rawAtts;
                                    }
                                    if (taskAtts.isEmpty) {
                                      return const SizedBox.shrink();
                                    }

                                    return Padding(
                                      padding: const EdgeInsets.only(top: 8),
                                      child: Wrap(
                                        spacing: 6,
                                        children: taskAtts.map((att) {
                                          final name =
                                              (att is Map ? att['name'] : att)
                                                  ?.toString() ??
                                              'Material';
                                          return Chip(
                                            visualDensity:
                                                VisualDensity.compact,
                                            avatar: const Icon(
                                              Icons.attach_file,
                                              size: 14,
                                              color: Color(0xFF0D9488),
                                            ),
                                            label: Text(
                                              name,
                                              style: const TextStyle(
                                                fontSize: 11,
                                              ),
                                            ),
                                          );
                                        }).toList(),
                                      ),
                                    );
                                  },
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.timer_outlined,
                                          size: 16,
                                          color: Color(0xFF94A3B8),
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          dueDate.length >= 10
                                              ? 'Due: ${dueDate.substring(0, 10)}'
                                              : 'Due Soon',
                                          style: const TextStyle(
                                            color: Color(0xFF64748B),
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (isTeacher)
                                      OutlinedButton.icon(
                                        icon: const Icon(
                                          Icons.people_outline,
                                          size: 16,
                                        ),
                                        label: Text(
                                          l10n?.submissions ?? 'Submissions',
                                        ),
                                        onPressed: () =>
                                            _viewSubmissionsDialog(task),
                                      )
                                    else if (!isSubmitted)
                                      ElevatedButton.icon(
                                        icon: const Icon(
                                          Icons.upload_file,
                                          size: 16,
                                        ),
                                        label: Text(
                                          l10n?.submitWork ?? 'Submit Work',
                                        ),
                                        onPressed: () =>
                                            _openSubmitHomeworkDialog(task),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
