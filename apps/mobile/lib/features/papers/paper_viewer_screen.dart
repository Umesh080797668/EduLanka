import 'dart:io';
import 'package:flutter/material.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

class PaperViewerScreen extends StatefulWidget {
  final String title;
  final String? paperUrl;
  final String? localFilePath;
  final String? markingSchemeUrl;

  const PaperViewerScreen({
    super.key,
    required this.title,
    this.paperUrl,
    this.localFilePath,
    this.markingSchemeUrl,
  });

  @override
  State<PaperViewerScreen> createState() => _PaperViewerScreenState();
}

class _PaperViewerScreenState extends State<PaperViewerScreen> {
  bool _showingMarkingScheme = false;

  @override
  Widget build(BuildContext context) {
    final activeUrl = _showingMarkingScheme
        ? widget.markingSchemeUrl
        : widget.paperUrl;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        backgroundColor: const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
        actions: [
          if (widget.markingSchemeUrl != null)
            TextButton.icon(
              icon: Icon(
                _showingMarkingScheme ? Icons.assignment : Icons.fact_check_rounded,
                color: Colors.amberAccent,
              ),
              label: Text(
                _showingMarkingScheme ? 'Question Paper' : 'Marking Scheme',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              onPressed: () {
                setState(() {
                  _showingMarkingScheme = !_showingMarkingScheme;
                });
              },
            ),
        ],
      ),
      body: widget.localFilePath != null && File(widget.localFilePath!).existsSync()
          ? SfPdfViewer.file(File(widget.localFilePath!))
          : activeUrl != null && activeUrl.isNotEmpty
              ? SfPdfViewer.network(activeUrl)
              : const Center(
                  child: Text('Document unavailable or file not downloaded.'),
                ),
    );
  }
}
