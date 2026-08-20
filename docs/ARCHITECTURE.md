# EduLanka — Architecture Overview

## C4 Level 1: System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        EduLanka Platform                        │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │  Next.js    │   │  NestJS API  │   │  Flutter App       │   │
│  │  Web App    │──▶│  REST API    │   │  (Phase 3)         │   │
│  │ (apps/web)  │   │  (apps/api)  │   │                    │   │
│  └─────────────┘   └──────┬───────┘   └────────────────────┘   │
│                           │                                     │
│               ┌───────────┼──────────────┐                      │
│               ▼           ▼              ▼                      │
│         ┌──────────┐ ┌─────────┐ ┌──────────────┐              │
│         │ Supabase │ │  Redis  │ │   Nginx GW   │              │
│         │(Postgres)│ │Sessions │ │  Rate limit  │              │
│         └──────────┘ └─────────┘ └──────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## C4 Level 2: Container Diagram (Phase 1)

| Container | Technology | Role |
|---|---|---|
| `edu-nginx` | Nginx 1.27 | API gateway, rate limiting, SSL termination |
| `edu-web` | Next.js 15+ (App Router, `next-intl`) | Web dashboards for all roles (Localized: EN, SI, TA) |
| `edu-api` | NestJS 10 + Fastify | REST API, JWT auth, business logic |
| `edu-postgres` | PostgreSQL 15 (Supabase) | Multi-tenant schema-per-tenant data store |
| `edu-redis` | Redis 7 | Session storage, rate-limiting state |

## Workspace Layout

```
edu-lanka-monorepo/
├── apps/
│   ├── web/          # @edu-lanka/web    — Next.js 15+ dashboard
│   └── api/          # @edu-lanka/api    — NestJS REST API
├── packages/
│   ├── shared-types/ # @edu-lanka/shared-types — DTOs, enums, interfaces
│   ├── config/       # @edu-lanka/config       — ESLint & TSConfig presets
│   └── ui/           # @edu-lanka/ui           — Shared React components (stub)
├── infrastructure/
│   ├── docker/       # Dockerfiles + docker-compose.yml
│   ├── nginx/        # nginx.conf + conf.d/
│   └── envs/         # .env.*.example templates
├── docs/             # Architecture, branching, setup docs
└── .github/          # CI workflows + PR template
```

## Multi-Tenant Strategy

**Schema-per-tenant** via Supabase:
- Each school is provisioned with its own Postgres schema (e.g. `tenant_richmond_college`)
- Row-Level Security (RLS) policies enforce data isolation at the DB level
- The `X-Tenant-Id` header is validated by the `TenantGuard` on every protected route
- The `TenantGuard` enforces that the JWT `tenantId` claim matches the header before any query runs

## Auth Flow

```
Browser → POST /api/v1/auth/login
       ← { accessToken (15m), refreshToken (7d) }
       → requests with: Authorization: Bearer <accessToken>
                        X-Tenant-Id: <tenantId>
       ← data scoped to that tenant
```

## Phase Additions (future services)

Each phase introduces new NestJS modules / services:

| Phase | Additions |
|---|---|
| 2 | `modules/chat` (WebSocket gateway), `modules/notices`, `modules/sms` |
| 3 | Flutter app, Prisma ORM for Super Admin microservice, `modules/media` (Cloudinary), `modules/sms` |
| 4 | Separate `apps/ai-engine` (Python/FastAPI), Meilisearch, Vector DB |
| 5 | ML models served by ai-engine |
| 6 | `apps/analytics` (ClickHouse ETL), Google OR-Tools timetabling service |
