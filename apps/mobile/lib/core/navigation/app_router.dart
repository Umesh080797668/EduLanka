import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state.dart';
import '../../features/auth/login_screen.dart';
import '../../features/home/student_home.dart';
import '../../features/home/teacher_home.dart';
import '../../features/home/parent_home.dart';

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
