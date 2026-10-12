import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state.dart';
import '../../features/auth/login_screen.dart';
import '../../features/home/student_home.dart';
import '../../features/home/teacher_home.dart';
import '../../features/home/parent_home.dart';
import '../../features/papers/paper_viewer_screen.dart';
import '../../features/video/video_player_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/student',
        builder: (context, state) => const StudentHomeScreen(),
      ),
      GoRoute(
        path: '/teacher',
        builder: (context, state) => const TeacherHomeScreen(),
      ),
      GoRoute(
        path: '/parent',
        builder: (context, state) => const ParentHomeScreen(),
      ),
      GoRoute(
        path: '/paper-viewer',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return PaperViewerScreen(
            title: extra['title'] as String? ?? 'Past Paper',
            paperUrl: extra['paperUrl'] as String?,
            localFilePath: extra['localFilePath'] as String?,
            markingSchemeUrl: extra['markingSchemeUrl'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/video-player',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return VideoPlayerScreen(
            title: extra['title'] as String? ?? 'Curriculum Video Lesson',
            videoUrl: extra['videoUrl'] as String?,
            localFilePath: extra['localFilePath'] as String?,
          );
        },
      ),
    ],
    redirect: (context, state) {
      final isLoggingIn = state.matchedLocation == '/login';

      if (!authState.isAuthenticated) {
        return isLoggingIn ? null : '/login';
      }

      if (isLoggingIn || state.matchedLocation == '/') {
        switch (authState.role) {
          case 'TEACHER':
            return '/teacher';
          case 'PARENT':
            return '/parent';
          case 'STUDENT':
          default:
            return '/student';
        }
      }

      return null;
    },
  );
});
