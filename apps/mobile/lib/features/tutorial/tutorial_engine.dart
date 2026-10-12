import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TutorialStep {
  final String stepId;
  final String target;
  final Map<String, String> title;
  final Map<String, String> description;

  TutorialStep({
    required this.stepId,
    required this.target,
    required this.title,
    required this.description,
  });

  factory TutorialStep.fromJson(Map<String, dynamic> json) {
    return TutorialStep(
      stepId: json['stepId'] as String,
      target: json['target'] as String,
      title: Map<String, String>.from(json['title'] as Map),
      description: Map<String, String>.from(json['description'] as Map),
    );
  }
}

class TutorialTour {
  final String tourId;
  final int version;
  final Map<String, String> title;
  final List<TutorialStep> steps;

  TutorialTour({
    required this.tourId,
    required this.version,
    required this.title,
    required this.steps,
  });

  factory TutorialTour.fromJson(Map<String, dynamic> json) {
    final rawSteps = json['steps'] as List;
    return TutorialTour(
      tourId: json['tourId'] as String,
      version: json['version'] as int? ?? 1,
      title: Map<String, String>.from(json['title'] as Map),
      steps: rawSteps
          .map((s) => TutorialStep.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }
}

class TutorialEngine {
  static const String _prefPrefix = 'edulanka_tutorial_seen_';

  static Future<bool> hasSeenTour(String tourId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('$_prefPrefix$tourId') ?? false;
  }

  static Future<void> markTourSeen(String tourId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_prefPrefix$tourId', true);
  }

  static Future<TutorialTour?> loadTour(String tourId) async {
    try {
      final jsonStr = await rootBundle.loadString(
        'assets/tutorials/$tourId.json',
      );
      final data = jsonDecode(jsonStr) as Map<String, dynamic>;
      return TutorialTour.fromJson(data);
    } catch (_) {
      return null;
    }
  }

  static Future<void> showTourIfUnseen(
    BuildContext context,
    String tourId,
  ) async {
    final seen = await hasSeenTour(tourId);
    if (!seen && context.mounted) {
      await showTour(context, tourId);
    }
  }

  static Future<void> showTour(BuildContext context, String tourId) async {
    final tour = await loadTour(tourId);
    if (tour == null || tour.steps.isEmpty || !context.mounted) return;

    await showDialog(
      context: context,
      builder: (ctx) => _TutorialDialog(tour: tour),
    );

    await markTourSeen(tourId);
  }
}

class _TutorialDialog extends StatefulWidget {
  final TutorialTour tour;

  const _TutorialDialog({required this.tour});

  @override
  State<_TutorialDialog> createState() => _TutorialDialogState();
}

class _TutorialDialogState extends State<_TutorialDialog> {
  int _currentStepIndex = 0;

  String _getLocale(BuildContext context) {
    final code = Localizations.localeOf(context).languageCode;
    return (code == 'si' || code == 'ta') ? code : 'en';
  }

  @override
  Widget build(BuildContext context) {
    final lang = _getLocale(context);
    final step = widget.tour.steps[_currentStepIndex];
    final isLast = _currentStepIndex == widget.tour.steps.length - 1;

    final stepTitle = step.title[lang] ?? step.title['en'] ?? '';
    final stepDesc = step.description[lang] ?? step.description['en'] ?? '';

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          const Icon(Icons.school_rounded, color: Color(0xFF1E40AF)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              stepTitle,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(stepDesc, style: const TextStyle(fontSize: 14, height: 1.4)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              widget.tour.steps.length,
              (index) => Container(
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: index == _currentStepIndex
                      ? const Color(0xFF1E40AF)
                      : Colors.grey.shade300,
                ),
              ),
            ),
          ),
        ],
      ),
      actions: [
        if (_currentStepIndex > 0)
          TextButton(
            onPressed: () {
              setState(() {
                _currentStepIndex--;
              });
            },
            child: const Text('Previous'),
          ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Skip'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1E40AF),
            foregroundColor: Colors.white,
          ),
          onPressed: () {
            if (isLast) {
              Navigator.of(context).pop();
            } else {
              setState(() {
                _currentStepIndex++;
              });
            }
          },
          child: Text(isLast ? 'Get Started' : 'Next'),
        ),
      ],
    );
  }
}
