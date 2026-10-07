# ADR-004: Mobile State Management — Flutter Riverpod

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 1 (P3-S1)

---

## Context

Phase 3 introduces the EduLanka Flutter mobile application. The app requires managing authentication state, tenant switching, role-based UI variations, network connectivity transitions, and reactive data streams fed from local encrypted SQLite tables.

We evaluated two leading state management architectures:
1. **flutter_bloc:** Established enterprise choice with explicit events and states.
2. **flutter_riverpod (Riverpod 2.x):** Compile-safe, declarative provider model with native `StreamProvider` and `FutureProvider`.

---

## Decision

We adopt **Flutter Riverpod (2.x with code generation / `riverpod_generator`)** as the primary state management framework for EduLanka mobile.

### Rationale:
1. **Drift Stream Ergonomics:** Drift generates type-safe reactive streams for database queries (`watch()`). Riverpod's `StreamProvider.autoDispose` binds directly to Drift streams with zero boilerplate:
   ```dart
   @riverpod
   Stream<List<AttendanceRecord>> classAttendance(ClassAttendanceRef ref, String classId) {
     final db = ref.watch(appDatabaseProvider);
     return db.attendanceDao.watchClassAttendance(classId);
   }
   ```
2. **Minimal Boilerplate for Solo/Lean Development:** Unlike Bloc, which requires separate Event, State, and Bloc classes for each feature slice, Riverpod Notifiers express business logic concisely.
3. **Compile-Time Safety & Testability:** Providers are declared globally without relying on `BuildContext` inheritance, making unit testing of business logic straightforward without widget harness mocking.
4. **Offline Connectivity Reactivity:** A global `connectivityStatusProvider` can be watched by all feature providers to trigger sync or switch UI badges smoothly.

---

## Consequences

### Positive
- Direct, reactive integration with Drift database streams.
- Extremely low boilerplate compared to Bloc.
- Clean separation of business logic and presentation widgets.
- Scoped lifecycle management via `autoDispose`.

### Trade-offs
- Requires discipline with provider scoping to avoid excessive rebuilds in complex nested widget trees.
