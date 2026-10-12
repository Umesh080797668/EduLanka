import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state.dart';
import '../../features/auth/login_screen.dart';
import '../../features/home/admin_home.dart';
import '../../features/home/student_home.dart';
import '../../features/home/teacher_home.dart';
import '../../features/home/parent_home.dart';
import '../../features/papers/paper_viewer_screen.dart';
import '../../features/video/video_player_screen.dart';

/// Notifier that bridges Riverpod AuthState changes to GoRouter's refreshListenable
/// without destroying and rebuilding the GoRouter instance.
class AuthChangeNotifier extends ChangeNotifier {
  final Ref _ref;
  AuthChangeNotifier(this._ref) {
    _ref.listen<AuthState>(authProvider, (_, __) {
      notifyListeners();
    });
  }
}

final authChangeNotifierProvider = Provider<AuthChangeNotifier>((ref) {
  return AuthChangeNotifier(ref);
});

String _homeForRole(String? role) {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'SCHOOL_ADMIN':
      return '/admin';
    case 'TEACHER':
      return '/teacher';
    case 'PARENT':
      return '/parent';
    case 'STUDENT':
    default:
      return '/student';
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authChangeNotifierProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: authNotifier,
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/admin',
        builder: (context, state) => const AdminHomeScreen(),
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
      final authState = ref.read(authProvider);
      final isLoggingIn = state.matchedLocation == '/login';

      if (!authState.isAuthenticated) {
        return isLoggingIn ? null : '/login';
      }

      final role = authState.role;

      // Handle root redirect and login bounce
      if (isLoggingIn || state.matchedLocation == '/') {
        return _homeForRole(role);
      }

      // Per-route role-based access guards
      final path = state.matchedLocation;

      if (path.startsWith('/admin') &&
          role != 'SUPER_ADMIN' &&
          role != 'SCHOOL_ADMIN') {
        return _homeForRole(role);
      }

      if (path.startsWith('/teacher') &&
          role != 'TEACHER' &&
          role != 'SUPER_ADMIN' &&
          role != 'SCHOOL_ADMIN') {
        return _homeForRole(role);
      }

      if (path.startsWith('/parent') &&
          role != 'PARENT' &&
          role != 'SUPER_ADMIN') {
        return _homeForRole(role);
      }

      if (path.startsWith('/student') &&
          role != 'STUDENT' &&
          role != 'SUPER_ADMIN' &&
          role != 'SCHOOL_ADMIN') {
        return _homeForRole(role);
      }

      return null;
    },
  );
});
