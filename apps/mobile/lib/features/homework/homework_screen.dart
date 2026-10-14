import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';

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
        final offlineTasks = await LocalDatabase.instance.getOfflineHomeworkTasks();
        if (mounted) setState(() => _tasks = offlineTasks);
      }
    } catch (_) {
      // Offline fallback: load from local SQLite
      final offlineTasks = await LocalDatabase.instance.getOfflineHomeworkTasks();
      if (mounted) setState(() => _tasks = offlineTasks);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openAssignHomeworkDialog() async {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    final classIdController = TextEditingController(text: const Uuid().v4());
    DateTime selectedDate = DateTime.now().add(const Duration(days: 3));

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.edit_note_rounded, color: Color(0xFF0D9488)),
              SizedBox(width: 8),
              Text('Assign New Homework'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(labelText: 'Homework Title'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descController,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Instructions / Problems'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: classIdController,
                  decoration: const InputDecoration(
                    labelText: 'Target Class UUID',
                    helperText: 'UUID of assigned class',
                  ),
                ),
                const SizedBox(height: 16),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_today_rounded, color: Color(0xFF0D9488)),
                  title: Text(
                    'Due: ${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}',
                  ),
                  trailing: TextButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: ctx,
                        initialDate: selectedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 90)),
                      );
                      if (picked != null) {
                        setDialogState(() => selectedDate = picked);
                      }
                    },
                    child: const Text('Change'),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                foregroundColor: Colors.white,
              ),
              onPressed: () async {
                final title = titleController.text.trim();
                final desc = descController.text.trim();
                final classId = classIdController.text.trim();
                if (title.isEmpty || classId.isEmpty) return;

                final apiClient = ref.read(apiClientProvider);
                try {
                  await apiClient.createHomeworkTask({
                    'classId': classId,
                    'title': title,
                    'description': desc,
                    'dueDate': selectedDate.toUtc().toIso8601String(),
                  });
                  if (ctx.mounted) Navigator.of(ctx).pop();
                  await _loadHomeworkTasks();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Homework assigned and published.'),
                        backgroundColor: Color(0xFF10B981),
                      ),
                    );
                  }
                } catch (e) {
                  // Fallback: save offline
                  await LocalDatabase.instance.saveOfflineHomeworkTasks([
                    {
                      'id': const Uuid().v4(),
                      'classId': classId,
                      'title': title,
                      'description': desc,
                      'dueDate': selectedDate.toUtc().toIso8601String(),
                    }
                  ]);
                  if (ctx.mounted) Navigator.of(ctx).pop();
                  await _loadHomeworkTasks();
                }
              },
              child: const Text('Publish'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openSubmitHomeworkDialog(Map<String, dynamic> task) async {
    final contentController = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Submit: ${task['title']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              task['description']?.toString() ?? '',
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: contentController,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Your Solution / Answer',
                border: OutlineInputBorder(),
                hintText: 'Type your completed homework text...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1E40AF),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              final content = contentController.text.trim();
              if (content.isEmpty) return;

              final auth = ref.read(authProvider);
              final taskId = task['id']?.toString() ?? '';
              final studentId = auth.userId ?? '';
              final clientUuid = const Uuid().v4();

              try {
                final apiClient = ref.read(apiClientProvider);
                await apiClient.submitHomework(taskId, {
                  'content': content,
                  'clientUuid': clientUuid,
                });
                if (ctx.mounted) Navigator.of(ctx).pop();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Homework submitted successfully!'),
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
                  clientUuid: clientUuid,
                );
                if (ctx.mounted) Navigator.of(ctx).pop();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Homework queued in offline outbox. Will sync when online.'),
                      backgroundColor: Color(0xFFF59E0B),
                    ),
                  );
                }
              }
              await _loadHomeworkTasks();
            },
            child: const Text('Submit'),
          ),
        ],
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
        builder: (ctx, scrollController) => Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Submissions: ${task['title']}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              const Divider(),
              if (submissions.isEmpty)
                const Expanded(
                  child: Center(
                    child: Text('No submissions received yet for this task.'),
                  ),
                )
              else
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: submissions.length,
                    itemBuilder: (ctx, index) {
                      final sub = submissions[index] as Map<String, dynamic>;
                      final studentUser = sub['users'] as Map<String, dynamic>?;
                      final studentName = studentUser?['full_name'] ?? 'Student';
                      final grade = sub['grade']?.toString();
                      final content = sub['content']?.toString() ?? '';

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(studentName),
                          subtitle: Text(content),
                          trailing: grade != null
                              ? Chip(
                                  label: Text(grade),
                                  backgroundColor: const Color(0xFFD1FAE5),
                                )
                              : ElevatedButton(
                                  onPressed: () => _openGradingDialog(sub['id']?.toString() ?? ''),
                                  child: const Text('Grade'),
                                ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openGradingDialog(String submissionId) async {
    final gradeController = TextEditingController(text: 'A');
    final feedbackController = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Grade Submission'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: gradeController,
              decoration: const InputDecoration(labelText: 'Grade (e.g. A, B+, 90/100)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: feedbackController,
              decoration: const InputDecoration(labelText: 'Teacher Feedback'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
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
                    const SnackBar(content: Text('Grade saved successfully.')),
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
            child: const Text('Save Grade'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final isTeacher = auth.role == 'TEACHER' || auth.role == 'SCHOOL_ADMIN';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Homework & Assignments'),
        backgroundColor: isTeacher ? const Color(0xFF0D9488) : const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
      ),
      floatingActionButton: isTeacher
          ? FloatingActionButton.extended(
              backgroundColor: const Color(0xFF0D9488),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('Assign Homework'),
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
                          Icon(Icons.assignment_outlined, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 12),
                          const Text(
                            'No homework assigned right now.',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 16),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _tasks.length,
                      itemBuilder: (ctx, index) {
                        final task = _tasks[index] is Map ? _tasks[index] as Map<String, dynamic> : <String, dynamic>{};
                        final title = task['title']?.toString() ?? 'Task';
                        final desc = task['description']?.toString() ?? '';
                        final dueDate = task['due_date']?.toString() ?? task['dueDate']?.toString() ?? '';
                        final mySub = task['mySubmission'] as Map<String, dynamic>?;
                        final isSubmitted = mySub != null;
                        final grade = mySub?['grade']?.toString();

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                                        label: Text(grade != null ? 'Graded: $grade' : 'Submitted'),
                                        backgroundColor: grade != null
                                            ? const Color(0xFFD1FAE5)
                                            : const Color(0xFFDBEAFE),
                                      )
                                    else if (!isTeacher)
                                      const Chip(
                                        label: Text('Pending'),
                                        backgroundColor: Color(0xFFFEF3C7),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  desc,
                                  style: const TextStyle(color: Color(0xFF475569)),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(Icons.timer_outlined, size: 16, color: Color(0xFF94A3B8)),
                                        const SizedBox(width: 4),
                                        Text(
                                          dueDate.length >= 10 ? 'Due: ${dueDate.substring(0, 10)}' : 'Due Soon',
                                          style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                                        ),
                                      ],
                                    ),
                                    if (isTeacher)
                                      OutlinedButton.icon(
                                        icon: const Icon(Icons.people_outline, size: 16),
                                        label: const Text('Submissions'),
                                        onPressed: () => _viewSubmissionsDialog(task),
                                      )
                                    else if (!isSubmitted)
                                      ElevatedButton.icon(
                                        icon: const Icon(Icons.upload_file, size: 16),
                                        label: const Text('Submit Work'),
                                        onPressed: () => _openSubmitHomeworkDialog(task),
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
