import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../l10n/app_localizations.dart';

class CreateBlogScreen extends ConsumerStatefulWidget {
  const CreateBlogScreen({super.key});

  @override
  ConsumerState<CreateBlogScreen> createState() => _CreateBlogScreenState();
}

class _CreateBlogScreenState extends ConsumerState<CreateBlogScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final _tagsController = TextEditingController();
  final _coverUrlController = TextEditingController();

  String _scope = 'SCHOOL';
  String? _selectedClassId;
  List<Map<String, dynamic>> _classes = [];
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadTeacherClasses();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    _tagsController.dispose();
    _coverUrlController.dispose();
    super.dispose();
  }

  Future<void> _loadTeacherClasses() async {
    try {
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.dio.get('/classes');
      final raw = res.data;
      if (raw is Map && raw['data'] is List) {
        setState(() {
          _classes = List<Map<String, dynamic>>.from(raw['data']);
          if (_classes.isNotEmpty) {
            _selectedClassId = _classes.first['id']?.toString();
          }
        });
      } else if (raw is List) {
        setState(() {
          _classes = List<Map<String, dynamic>>.from(raw);
          if (_classes.isNotEmpty) {
            _selectedClassId = _classes.first['id']?.toString();
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _publishBlog() async {
    if (!_formKey.currentState!.validate()) return;
    if (_scope == 'CLASS' && _selectedClassId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a class for class-scoped blogs'),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final tags = _tagsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.dio.post(
        '/blogs',
        data: {
          'title': _titleController.text.trim(),
          'contentMarkdown': _contentController.text.trim(),
          'scope': _scope,
          if (_scope == 'CLASS') 'classId': _selectedClassId,
          if (_tagsController.text.trim().isNotEmpty) 'tags': tags,
          if (_coverUrlController.text.trim().isNotEmpty)
            'coverImageUrl': _coverUrlController.text.trim(),
          'isPublished': true,
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Educational blog published successfully!'),
          ),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to publish article: $e')),
        );
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n?.authorArticle ?? 'Author Educational Article'),
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _isSubmitting ? null : _publishBlog,
            icon: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check, color: Color(0xFF38BDF8)),
          ),
        ],
      ),
      body: Container(
        color: const Color(0xFF0F172A),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Scope & Distribution',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _scope,
                      isExpanded: true,
                      dropdownColor: const Color(0xFF1E293B),
                      style: const TextStyle(color: Colors.white),
                      items: const [
                        DropdownMenuItem(
                          value: 'SCHOOL',
                          child: Text(
                            'School-Wide (All students & teachers in school)',
                          ),
                        ),
                        DropdownMenuItem(
                          value: 'CLASS',
                          child: Text(
                            'Class-Wide (Scoped to specific assigned class)',
                          ),
                        ),
                        DropdownMenuItem(
                          value: 'PLATFORM',
                          child: Text(
                            'National Platform-Wide (Entire EduLanka Network)',
                          ),
                        ),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _scope = val);
                      },
                    ),
                  ),
                ),
                if (_scope == 'CLASS') ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Target Class',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedClassId,
                        isExpanded: true,
                        dropdownColor: const Color(0xFF1E293B),
                        style: const TextStyle(color: Colors.white),
                        hint: const Text(
                          'Select Class',
                          style: TextStyle(color: Colors.white60),
                        ),
                        items: _classes.map((c) {
                          return DropdownMenuItem<String>(
                            value: c['id']?.toString(),
                            child: Text('${c['name']} (Grade ${c['grade']})'),
                          );
                        }).toList(),
                        onChanged: (val) =>
                            setState(() => _selectedClassId = val),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                const Text(
                  'Article Title',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _titleController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration(
                    'e.g. Solving Quadratic Equations with Proofs',
                  ),
                  validator: (v) => v == null || v.trim().isEmpty
                      ? 'Title is required'
                      : null,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Cover Image URL (Optional)',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _coverUrlController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration(
                    'https://res.cloudinary.com/...',
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Tags (Comma separated)',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _tagsController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration(
                    'maths, algebra, o-level, term-1',
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Article Content (Markdown)',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _contentController,
                  maxLines: 12,
                  style: const TextStyle(color: Colors.white, height: 1.5),
                  decoration: _inputDecoration(
                    '# Introduction\nWrite your rich academic lesson, walkthrough, diagrams, and model exam answers here...',
                  ),
                  validator: (v) => v == null || v.trim().isEmpty
                      ? 'Content is required'
                      : null,
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _publishBlog,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: _isSubmitting
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text(
                            'Publish Academic Article',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
      filled: true,
      fillColor: const Color(0xFF1E293B),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFF334155)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFF334155)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFF0284C7)),
      ),
    );
  }
}
