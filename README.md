# EduLanka — National-Scale Educational SaaS Platform

> A multi-tenant school management platform engineered for Sri Lanka — Grades 1–13, offline-first Flutter mobile app, Twilio SMS, and an AI academic assistant powered by Qwen RAG.

[![CI](https://github.com/YOUR_ORG/edu-lanka/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/edu-lanka/actions/workflows/ci.yml)

---

## Tech Stack (Phase 1)

| Layer | Technology |
|---|---|
| Web Frontend | Next.js 15+ (App Router, Turbopack, Tailwind v4) |
| API Backend | NestJS 10 + Fastify |
| Database | Supabase (PostgreSQL 15, schema-per-tenant) |
| Cache / Sessions | Redis 7 |
| API Gateway | Nginx 1.27 (rate limiting, proxy) |
| Monorepo | pnpm workspaces + Turborepo |
| CI/CD | GitHub Actions |
| Container | Docker + Docker Compose |

## Workspace Structure

```
edu-lanka-monorepo/
├── apps/
│   ├── web/                  # Next.js dashboard (Student, Parent, Teacher, Admin)
│   └── api/                  # NestJS REST API
├── packages/
│   ├── shared-types/         # Shared TypeScript interfaces & enums
│   ├── config/               # Shared ESLint & TSConfig presets
│   └── ui/                   # Shared React component primitives
├── infrastructure/
│   ├── docker/               # docker-compose.yml + Dockerfiles
│   ├── nginx/                # nginx.conf + gateway virtual host
│   └── envs/                 # .env.*.example templates
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BRANCHING_STRATEGY.md
│   └── ENVIRONMENT_SETUP.md
└── .github/
    ├── workflows/
    │   ├── ci.yml            # Lint → Typecheck → Build → Test
    │   └── deploy-staging.yml
    └── PULL_REQUEST_TEMPLATE.md
```

## Quick Start

### Prerequisites
- Node.js ≥ 20, pnpm ≥ 9, Docker ≥ 24

### 1. Install dependencies
```bash
pnpm install
```

### 2. Set up environment variables
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 3. Start local dev stack
```bash
cd infrastructure/docker && docker compose up --build -d
```

### 4. Verify
```bash
curl http://localhost/api/v1/health
# → { "status": "ok", ... }
```

> See [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) for full setup instructions.

---

## Development Scripts (from root)

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in watch mode |
| `pnpm build` | Build all workspaces (Turborepo) |
| `pnpm lint` | ESLint across all workspaces |
| `pnpm typecheck` | TypeScript noEmit check |
| `pnpm test` | Run all unit tests |
| `pnpm format` | Prettier format all files |

## Phase Roadmap

| Phase | Focus | Status |
|---|---|---|
| **Sprint 0** | Monorepo, infrastructure, CI | ✅ Done |
| **Phase 1** | Core school management, auth, report cards | 🔜 Next |
| **Phase 2** | Chat, notices, Twilio SMS, Disaster Mode | ⏳ Planned |
| **Phase 3** | Flutter app, offline sync, media hub | ⏳ Planned |
| **Phase 4** | Qwen RAG AI academic assistant | ⏳ Planned |
| **Phase 5** | Early Warning System, exam predictions | ⏳ Planned |
| **Phase 6** | Timetabling, MoE analytics, marketplace | ⏳ Planned |

## Contributing

See [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md) for the Git workflow and branch naming conventions.

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Directories / packages | `kebab-case` | `core-school-service` |
| NestJS modules/classes | `PascalCase` | `TenantModule` |
| TypeScript functions | `camelCase` | `getTenantById()` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `DATABASE_URL` |
| DB tables | `snake_case` | `student_profiles` |
| Docker services | `kebab-case` | `edu-api`, `edu-web` |
