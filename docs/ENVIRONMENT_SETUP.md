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
docker compose up --build -d

# Verify all services are healthy
docker compose ps

# Check API health
curl http://localhost/api/v1/health
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

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy:
   - **URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
3. Run migrations via the Supabase SQL editor or CLI when available

```bash
# Optional: use Supabase CLI to run migrations against cloud
npx supabase db push --project-ref <your-ref>
```

## Troubleshooting

| Issue | Fix |
|---|---|
| Port 8081 already in use | `sudo lsof -i :8081` to find and stop the conflicting process |
| `pnpm install` fails on shared-types | Run `pnpm install` from monorepo root, not inside `packages/` |
| Nginx 502 Bad Gateway | `edu-api` not ready yet — run `docker compose logs edu-api` to check |
| JWT errors in API | Ensure `JWT_SECRET` is at least 32 characters |
| Supabase auth 401 | Ensure `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** key, not the anon key |
