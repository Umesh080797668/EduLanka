import 'dart:io';
import 'package:flutter/material.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import '../tutorial/tutorial_engine.dart';

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
  bool _isSplitMode = true;
  bool _showingMarkingSchemeOnly = false;

  @override
  void initState() {
    super.initState();
    _isSplitMode =
        widget.markingSchemeUrl != null && widget.markingSchemeUrl!.isNotEmpty;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      TutorialEngine.showTourIfUnseen(context, 'phase3_paper_hub');
    });
  }

  Widget _buildPaperView() {
    if (widget.localFilePath != null &&
        File(widget.localFilePath!).existsSync()) {
      return SfPdfViewer.file(File(widget.localFilePath!));
    } else if (widget.paperUrl != null && widget.paperUrl!.isNotEmpty) {
      return SfPdfViewer.network(widget.paperUrl!);
    }
    return const Center(
      child: Text('Question paper document unavailable or not downloaded.'),
    );
  }

  Widget _buildSchemeView() {
    if (widget.markingSchemeUrl != null &&
        widget.markingSchemeUrl!.isNotEmpty) {
      return SfPdfViewer.network(widget.markingSchemeUrl!);
    }
    return const Center(child: Text('Official marking scheme unavailable.'));
  }

  Widget _buildPaneHeader({
    required String title,
    required IconData icon,
    required Color color,
    VoidCallback? onMaximize,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      color: color.withValues(alpha: 0.12),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(
            title,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const Spacer(),
          if (onMaximize != null)
            InkWell(
              onTap: onMaximize,
              child: const Padding(
                padding: EdgeInsets.all(2.0),
                child: Icon(Icons.fullscreen, size: 18, color: Colors.black54),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasScheme =
        widget.markingSchemeUrl != null && widget.markingSchemeUrl!.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        backgroundColor: const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
        actions: [
          if (hasScheme) ...[
            IconButton(
              tooltip: _isSplitMode
                  ? 'Single Document Mode'
                  : 'Split Practice Mode',
              icon: Icon(
                _isSplitMode
                    ? Icons.vertical_split_rounded
                    : Icons.splitscreen_rounded,
                color: Colors.amberAccent,
              ),
              onPressed: () {
                setState(() {
                  _isSplitMode = !_isSplitMode;
                });
              },
            ),
            if (!_isSplitMode)
              TextButton.icon(
                icon: Icon(
                  _showingMarkingSchemeOnly
                      ? Icons.assignment
                      : Icons.fact_check_rounded,
                  color: Colors.amberAccent,
                ),
                label: Text(
                  _showingMarkingSchemeOnly ? 'Paper' : 'Scheme',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                onPressed: () {
                  setState(() {
                    _showingMarkingSchemeOnly = !_showingMarkingSchemeOnly;
                  });
                },
              ),
          ],
        ],
      ),
      body: OrientationBuilder(
        builder: (context, orientation) {
          if (!hasScheme || !_isSplitMode) {
            return _showingMarkingSchemeOnly
                ? _buildSchemeView()
                : _buildPaperView();
          }

          // In portrait orientation: Stack Question Paper and Marking Scheme vertically (S7)
          if (orientation == Orientation.portrait) {
            return Column(
              children: [
                Expanded(
                  flex: 1,
                  child: Column(
                    children: [
                      _buildPaneHeader(
                        title: 'Question Paper',
                        icon: Icons.assignment_outlined,
                        color: const Color(0xFF1E40AF),
                        onMaximize: () {
                          setState(() {
                            _isSplitMode = false;
                            _showingMarkingSchemeOnly = false;
                          });
                        },
                      ),
                      Expanded(child: _buildPaperView()),
                    ],
                  ),
                ),
                Container(
                  height: 4,
                  color: Colors.grey.shade300,
                  child: Center(
                    child: Container(
                      width: 40,
                      height: 2,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ),
                Expanded(
                  flex: 1,
                  child: Column(
                    children: [
                      _buildPaneHeader(
                        title: 'Official Marking Scheme',
                        icon: Icons.fact_check_outlined,
                        color: Colors.green.shade800,
                        onMaximize: () {
                          setState(() {
                            _isSplitMode = false;
                            _showingMarkingSchemeOnly = true;
                          });
                        },
                      ),
                      Expanded(child: _buildSchemeView()),
                    ],
                  ),
                ),
              ],
            );
          }

          // In landscape orientation: Show side-by-side split screen
          return Row(
            children: [
              Expanded(
                flex: 1,
                child: Column(
                  children: [
                    _buildPaneHeader(
                      title: 'Question Paper',
                      icon: Icons.assignment_outlined,
                      color: const Color(0xFF1E40AF),
                      onMaximize: () {
                        setState(() {
                          _isSplitMode = false;
                          _showingMarkingSchemeOnly = false;
                        });
                      },
                    ),
                    Expanded(child: _buildPaperView()),
                  ],
                ),
              ),
              Container(width: 4, color: Colors.grey.shade300),
              Expanded(
                flex: 1,
                child: Column(
                  children: [
                    _buildPaneHeader(
                      title: 'Official Marking Scheme',
                      icon: Icons.fact_check_outlined,
                      color: Colors.green.shade800,
                      onMaximize: () {
                        setState(() {
                          _isSplitMode = false;
                          _showingMarkingSchemeOnly = true;
                        });
                      },
                    ),
                    Expanded(child: _buildSchemeView()),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
