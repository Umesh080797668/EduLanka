import 'dart:io';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../core/download/decrypted_video_server.dart';
import '../../core/download/download_manager.dart';
import '../tutorial/tutorial_engine.dart';

class VideoPlayerScreen extends StatefulWidget {
  final String title;
  final String? videoUrl;
  final String? localFilePath;

  const VideoPlayerScreen({
    super.key,
    required this.title,
    this.videoUrl,
    this.localFilePath,
  });

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  VideoPlayerController? _controller;
  LocalDecryptedVideoServer? _decryptionServer;
  bool _isInitialized = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.localFilePath != null) {
        TutorialEngine.showTourIfUnseen(context, 'phase3_managing_downloads');
      } else {
        TutorialEngine.showTourIfUnseen(context, 'phase3_video_tour');
      }
    });
  }

  Future<void> _initializePlayer() async {
    try {
      if (widget.localFilePath != null &&
          File(widget.localFilePath!).existsSync()) {
        final filePath = widget.localFilePath!;
        if (filePath.endsWith('.enc.mp4')) {
          // Encrypted offline video: start loopback on-the-fly decryption streaming server (P3-S6, ADR-001)
          try {
            final server = await DownloadManager.instance
                .startDecryptedPlaybackServer(filePath);
            if (server != null) {
              _decryptionServer = server;
              _controller = VideoPlayerController.networkUrl(
                Uri.parse(server.url),
              );
            } else {
              setState(() {
                _errorMessage =
                    'Offline video key unavailable or expired. Please reconnect to renew your license.';
              });
              return;
            }
          } catch (e) {
            final isExpired =
                e.toString().contains('EXPIRED_KEY') ||
                e.toString().toLowerCase().contains('expired');
            setState(() {
              _errorMessage = isExpired
                  ? 'Video playback license has expired. Please reconnect to renew.'
                  : 'Failed to initialize encrypted video: ${e.toString()}';
            });
            return;
          }
        } else {
          _controller = VideoPlayerController.file(File(filePath));
        }
      } else if (widget.videoUrl != null && widget.videoUrl!.isNotEmpty) {
        _controller = VideoPlayerController.networkUrl(
          Uri.parse(widget.videoUrl!),
        );
      } else {
        setState(() {
          _errorMessage = 'No video source provided';
        });
        return;
      }

      await _controller!.initialize();
      _controller!.addListener(() {
        if (mounted) setState(() {});
      });

      setState(() {
        _isInitialized = true;
      });
      _controller!.play();
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load video: ${e.toString()}';
      });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    _decryptionServer?.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(widget.title),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: _errorMessage != null
            ? Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.lock_clock_outlined,
                      color: Color(0xFFEF4444),
                      size: 56,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        height: 1.4,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1E40AF),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                      ),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Try Again'),
                      onPressed: () {
                        setState(() {
                          _errorMessage = null;
                          _isInitialized = false;
                        });
                        _initializePlayer();
                      },
                    ),
                  ],
                ),
              )
            : _isInitialized && _controller != null
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AspectRatio(
                    aspectRatio: _controller!.value.aspectRatio,
                    child: Stack(
                      alignment: Alignment.bottomCenter,
                      children: [
                        VideoPlayer(_controller!),
                        VideoProgressIndicator(
                          _controller!,
                          allowScrubbing: true,
                          colors: const VideoProgressColors(
                            playedColor: Color(0xFF1E40AF),
                            bufferedColor: Colors.white24,
                            backgroundColor: Colors.white10,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        iconSize: 32,
                        color: Colors.white,
                        icon: const Icon(Icons.replay_10_rounded),
                        onPressed: () {
                          final pos = _controller!.value.position;
                          _controller!.seekTo(
                            pos - const Duration(seconds: 10),
                          );
                        },
                      ),
                      const SizedBox(width: 16),
                      IconButton(
                        iconSize: 48,
                        color: Colors.white,
                        icon: Icon(
                          _controller!.value.isPlaying
                              ? Icons.pause_circle_filled_rounded
                              : Icons.play_circle_fill_rounded,
                        ),
                        onPressed: () {
                          setState(() {
                            _controller!.value.isPlaying
                                ? _controller!.pause()
                                : _controller!.play();
                          });
                        },
                      ),
                      const SizedBox(width: 16),
                      IconButton(
                        iconSize: 32,
                        color: Colors.white,
                        icon: const Icon(Icons.forward_10_rounded),
                        onPressed: () {
                          final pos = _controller!.value.position;
                          _controller!.seekTo(
                            pos + const Duration(seconds: 10),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              )
            : const CircularProgressIndicator(color: Colors.white),
      ),
    );
  }
}
