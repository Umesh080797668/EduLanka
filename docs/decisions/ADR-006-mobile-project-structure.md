# ADR-006: Mobile Project Structure — Feature-First Monorepo Architecture

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 1 (P3-S1)

---

## Context

EduLanka is structured as a pnpm Turborepo monorepo containing `apps/web`, `apps/api`, and `packages/shared-types`. With Phase 3 introducing the Flutter mobile application, we must establish where the mobile codebase resides and how its internal codebase is structured to support scaling, full feature parity with web, and offline-first capabilities.

We evaluated two internal layout patterns:
1. **Layer-First (Presentation / Domain / Data across all features):** Grouping all controllers together, all screens together, and all repositories together. Becomes unwieldy as feature count grows past 10+ modules.
2. **Feature-First (Slices):** Every functional domain (auth, attendance, chat, notices, resources, disaster_pack) owns its presentation, application, domain, and data layers.

---

## Decision

We adopt a **Feature-First Architecture** located at **`apps/mobile`** inside the root monorepo.

### Monorepo Location:
```text
EduLanka/
├── apps/
│   ├── api/             (NestJS Core Service)
│   ├── web/             (Next.js Web Portal - 8 Portals)
│   └── mobile/          (Flutter Cross-Platform App)
├── packages/
│   └── shared-types/    (Shared TypeScript definitions)
└── docs/
```

### `apps/mobile/lib` Directory Layout:
```text
apps/mobile/lib/
├── app.dart                     # App-level MaterialApp, routing, themes
├── main.dart                    # Initialization, Keystore, Drift boot
├── core/                        # Cross-cutting infrastructure
│   ├── database/                # Drift database definition, SQLCipher setup
│   ├── network/                 # Dio client, auth interceptor, base URL
│   ├── sync/                    # Event-sourced sync manager & outbox processor
│   ├── theme/                   # Brand colors, typography, dark mode
│   └── utils/                   # Formatters, date helpers, logger
└── features/                    # Feature slices (Feature-First)
    ├── auth/                    # Login, token rotation, tenant selection
    │   ├── data/                # Remote auth data source, auth repo
    │   ├── domain/              # User model, token model
    │   └── presentation/        # LoginScreen, TenantPickerScreen, auth providers
    ├── attendance/              # Attendance marking & history
    │   ├── data/                # Drift attendance DAO, sync mapper
    │   ├── domain/              # AttendanceRecord, StudentRoster
    │   └── presentation/        # RollCallScreen, attendance providers
    ├── homework/                # Assignments, offline submission cache
    ├── chat/                    # Real-time WebSocket + cached chat
    ├── notices/                 # School notices, urgent alerts, acknowledgments
    ├── paper_hub/               # Past papers & split-screen marking schemes
    ├── resource_hub/            # Video streaming & encrypted offline downloads
    ├── disaster_pack/           # Offline emergency contacts, shelters, materials
    └── tutorials/               # Bundled offline coach-mark walkthroughs
```

---

## Consequences

### Positive
- High cohesion and low coupling: Developers working on "attendance" find all relevant models, UI, and DAOs in one directory.
- Easy to onboard and maintain by solo developer or small team.
- Direct mirroring of NestJS backend modules and Next.js portal routes, ensuring bidirectional Web ↔ Mobile feature parity.
- Self-contained testing: Each feature folder can have its matching `test/features/<feature>/` hierarchy.

### Trade-offs
- Core shared widgets (e.g. custom buttons, status chips) must be maintained disciplined in `core/widgets` to avoid duplication across feature folders.
