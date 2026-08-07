# EduLanka — Environment Setup Guide

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20.x | [nodejs.org](https://nodejs.org) or `nvm` |
| pnpm | ≥ 9.x | `corepack enable && corepack prepare pnpm@9.9.0 --activate` |
| Docker | ≥ 24.x | [docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | ≥ 2.x | Bundled with Docker Desktop |

## 1. Clone & Install

```bash
git clone https://github.com/<org>/edu-lanka.git
cd edu-lanka
pnpm install
```

## 2. Environment Variables

Copy the example files and fill in real values:

```bash
# NestJS API
cp apps/api/.env.example apps/api/.env

# Next.js Web
cp apps/web/.env.example apps/web/.env.local

# Docker Compose dev stack
cp infrastructure/envs/.env.dev.example infrastructure/envs/.env.dev
```

### Required secrets for local dev

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase **cloud** project URL — `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key (safe to expose in browser) |
| `JWT_SECRET` | Random string ≥ 32 chars — `openssl rand -hex 32` |
| `REDIS_PASSWORD` | Leave blank for local dev |

## 3. Start Local Dev Stack (Docker)

```bash
cd infrastructure/docker
docker-compose up --build -d

# Verify all services are healthy
docker-compose ps

# Check API health
curl http://localhost:8081/api/v1/health
```

Expected services after `docker compose up`:

| Service | URL | Status |
|---|---|---|
| Nginx gateway | http://localhost:**8081** | ✅ proxies all traffic (port 8081 — Tomcat owns 8080) |
| Next.js web | http://localhost:8081 (via Nginx) | ✅ |
| NestJS API | http://localhost:8081/api/v1 | ✅ |
| Redis | localhost:6379 | ✅ |
| Supabase DB | ☁️ cloud (no local container) | ✅ configured via env |

## 4. Run in Dev Mode (without Docker)

For faster iteration, run apps directly and point them at Supabase cloud:

```bash
# Terminal 1 — Build shared types first
pnpm --filter @edu-lanka/shared-types build

# Terminal 2 — NestJS API (ensure apps/api/.env is populated)
pnpm --filter @edu-lanka/api dev

# Terminal 3 — Next.js web (ensure apps/web/.env.local is populated)
pnpm --filter @edu-lanka/web dev
```

When running without Docker, set `REDIS_HOST=localhost` in `apps/api/.env`.

## 5. Run CI Checks Locally

```bash
pnpm run lint        # ESLint across all workspaces
pnpm run typecheck   # TypeScript noEmit across all workspaces
pnpm run build       # Turborepo full build
pnpm run test        # Jest unit tests
```

## 6. Supabase Cloud Setup

### 6.1 Create Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy:
   - **URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret — never expose in client)

### 6.2 Run Global Migrations (one-time bootstrap)

Open your Supabase project → **SQL Editor → New query** and run the following files **in order**:

#### Step 1 — Global tables + provisioning function

Paste and run the entire contents of:

```
supabase/migrations/20260807000001_global_tables.sql
```

This creates:
- `public.tenants` — tenant registry
- `public.plans` — FREE / PRO tiers (pre-seeded)
- `create_tenant_schema(p_slug TEXT)` — stored procedure that provisions a full per-tenant schema with RLS
- `drop_tenant_schema(p_slug TEXT)` — deprovision helper

> **Verify** — after running, check the **Table Editor**: you should see `tenants` and `plans` in the `public` schema. `plans` should already have 2 rows (FREE, PRO).

#### Step 2 — Seed the dev tenant

Paste and run:

```
supabase/seed.sql
```

This:
1. Inserts a `dev-school` tenant into `public.tenants`
2. Calls `create_tenant_schema('dev-school')` — creates a `tenant_dev-school` schema
3. Seeds 4 users (SCHOOL_ADMIN, TEACHER, STUDENT, PARENT), 1 class (Grade 10-A), 1 student record, and a parent link

> **Verify** — in the **Table Editor**, switch schema to `tenant_dev-school`. You should see the `users`, `classes`, `students`, and `parents` tables populated.

### 6.3 Provisioning New Tenants (via API)

Once the API is running, new tenants are provisioned through the REST endpoint:

```bash
# Obtain a SUPER_ADMIN JWT first (via POST /api/v1/auth/login)
TOKEN="<your-super-admin-jwt>"

curl -X POST http://localhost:8081/api/v1/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Richmond College",
    "slug": "richmond-college",
    "schoolType": "TYPE_1AB",
    "contactEmail": "admin@richmond.lk",
    "plan": "PRO"
  }'
```

The API inserts the tenant row and calls the `create_tenant_schema` RPC automatically. The new schema `tenant_richmond-college` will appear in Supabase within seconds.

### 6.4 Applying New Migrations Across All Tenants

When you add a new SQL migration that should apply to every existing tenant schema, use the CLI tool:

```bash
# From the monorepo root:
pnpm --filter api run migrate:tenants -- --file=supabase/migrations/<new_migration>.sql
```

Example output:
```
📄  Migration file: supabase/migrations/20260808000001_add_homework.sql
🏫  Migrating 3 tenant(s)...

  ✓ tenant_dev-school
  ✓ tenant_richmond-college
  ✓ tenant_nalanda-college

──────────────────────────────────
✅  3/3 succeeded
Migration complete.
```

The script targets only `ACTIVE` tenants. `SUSPENDED` or `DEPROVISIONED` tenants are skipped.

## Troubleshooting

| Issue | Fix |
|---|---|
| Port 8081 already in use | `sudo lsof -i :8081` to find and stop the conflicting process |
| `pnpm install` fails on shared-types | Run `pnpm install` from monorepo root, not inside `packages/` |
| Nginx 502 Bad Gateway | `edu-api` not ready yet — run `docker compose logs edu-api` to check |
| JWT errors in API | Ensure `JWT_SECRET` is at least 32 characters |
| Supabase auth 401 | Ensure `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** key, not the anon key |
