# EduLanka Deployment Manual

Follow these steps to deploy the EduLanka platform to production across your specified cloud services.

## 1. Upstash (Redis)
You need a Redis instance for backend caching, rate-limiting, and session management.
1. Go to [Upstash](https://upstash.com/) and create a new **Redis** database.
2. Select the region closest to your Vercel deployment (e.g., `us-east-1` or `ap-south-1`).
3. Keep the **TLS (SSL)** setting enabled.
4. Once created, copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**, or just the standard Redis connection string (`rediss://...`), depending on your `.env` requirements.

## 2. Supabase (Database & Auth)
Before going live, you must clear out all the local staging and test data.

1. Ensure the Supabase CLI is linked to your cloud project:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
2. Reset the cloud database to a clean slate using the provided NPM script:
   ```bash
   cd apps/api
   npm run cleanup:test-data
   # Or directly: npx supabase db reset --linked
   ```
   > [!WARNING]
   > This will **permanently delete** all remote data in the linked project and re-apply the clean migrations.

3. Make sure you have your Production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` ready.

## 3. Vercel — Deploying the Backend Services
Since EduLanka is a monorepo, you will deploy **two separate projects** in the Vercel dashboard pointing to the same GitHub repository.

### 3.1. Main API (`apps/api`)
The main backend handles authentication, tenant multi-tenancy, transactional APIs, and mobile sync endpoints.
1. In [Vercel Dashboard](https://vercel.com), click **Add New... > Project** and select your EduLanka repository.
2. In the "Configure Project" modal:
   - **Project Name**: `edulanka-api`
   - **Framework Preset**: Other
   - **Root Directory**: `apps/api` (Click "Edit" and choose `apps/api`)
   - **Build Command**: `npx turbo run build --filter=@edu-lanka/api...` (configured in `apps/api/vercel.json`)
   - **Output Directory**: `dist`
3. Expand **Environment Variables** and configure:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = `postgresql://postgres:<password>@<pooler-host>:6543/postgres?pgbouncer=true` (Supabase Connection Pooler)
   - `DIRECT_URL` = `postgresql://postgres:<password>@<db-host>:5432/postgres` (Supabase Direct)
   - `JWT_SECRET` = `<your-strong-production-jwt-secret>` (e.g., 32+ character random hex or base64 string)
   - `JWT_EXPIRES_IN` = `15m`
   - `JWT_REFRESH_EXPIRES_IN` = `7d`
   - `SUPABASE_URL` = `https://<your-project-id>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<your-service-role-key>`
   - `REDIS_URL` = `<your-upstash-redis-url>`
4. Click **Deploy**. Note your production URL (e.g., `https://edulanka-api.vercel.app`).

### 3.2. Analytics Microservice (`apps/analytics`)
The analytics microservice runs platform-wide aggregations, billing counts, storage ledger rollups, and sync health monitoring for Super Administrators.
1. In Vercel, click **Add New... > Project** and select the **same EduLanka repository**.
2. In the "Configure Project" modal:
   - **Project Name**: `edulanka-analytics`
   - **Framework Preset**: Other
   - **Root Directory**: `apps/analytics` (Click "Edit" and choose `apps/analytics`)
   - **Build Command**: `npx turbo run build --filter=@edu-lanka/analytics...` (configured in `apps/analytics/vercel.json`)
   - **Output Directory**: `dist`
3. Expand **Environment Variables** and configure:
   - `NODE_ENV` = `production`
   - `PORT` = `8083`
   - `ANALYTICS_DATABASE_URL` = `postgresql://analytics_ro:<ro-password>@<db-host>:5432/postgres?sslmode=require` (Dedicated read-only role)
   - `JWT_SECRET` = `<SAME-JWT_SECRET-as-apps/api>`
4. Click **Deploy**. Note your production URL (e.g., `https://edulanka-analytics.vercel.app`).

---

## 4. Netlify — Deploying Frontend Web (`apps/web`)
The frontend is a Next.js application running on Netlify. Netlify acts as the unified user-facing gateway, seamlessly proxying API requests to both Vercel backend services.

1. Go to [Netlify Dashboard](https://app.netlify.com) and click **Add new site > Import an existing project**.
2. Connect your GitHub repository.
3. In the site configuration:
   - **Base directory**: `apps/web`
   - **Build command**: `pnpm run build`
   - **Publish directory**: `.next`
4. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<your-project-id>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your-supabase-anon-key>`
   - `API_URL` = `https://edulanka-api.vercel.app/api` (Points to Vercel Project 1)
   - `ANALYTICS_API_URL` = `https://edulanka-analytics.vercel.app/api/analytics` (Points to Vercel Project 2)
   - `NEXT_PUBLIC_APP_URL` = `https://<your-site-name>.netlify.app`
5. Click **Deploy Site**.

### How Netlify Rewrites Route Traffic (Zero-CORS Architecture)
In `apps/web/next.config.ts`, reverse-proxy rewrites are already configured:
```ts
async rewrites() {
    return [
        {
            source: '/api/analytics/:path*',
            destination: `${process.env.ANALYTICS_API_URL}/:path*`,
        },
        {
            source: '/api/:path*',
            destination: `${process.env.API_URL}/:path*`,
        },
    ];
}
```
- When browser requests `/api/v1/auth/login` → Netlify server proxies directly to `https://edulanka-api.vercel.app/api/v1/auth/login`.
- When browser requests `/api/analytics/v1/tenants/active-students` → Netlify server proxies directly to `https://edulanka-analytics.vercel.app/api/analytics/v1/tenants/active-students`.
- **Result**: The browser only communicates with Netlify (single origin). There are **no CORS errors**, and all cookies and bearer tokens are forwarded transparently.

---

## 5. Architectural Connection: How `apps/analytics` Connects with `apps/api`

### 1. No Direct Inter-Service HTTP Coupling
`apps/analytics` and `apps/api` do **NOT** make synchronous HTTP calls to each other. This adheres to cloud-native microservice best practices:
- If `apps/analytics` is busy running heavy aggregation queries across millions of rows, `apps/api` is completely unaffected.
- If one service restarts or scales, the other remains 100% operational.

### 2. Shared Stateless JWT Authentication Contract
- When an administrator logs in via `apps/api/src/modules/auth`, `apps/api` signs a standard JSON Web Token containing `{ sub: userId, role: "SUPER_ADMIN", tenantId: null }` using `JWT_SECRET`.
- When the browser calls an analytics endpoint via Netlify, it attaches `Authorization: Bearer <token>`.
- `apps/analytics` shares the **exact same `JWT_SECRET`**. Its `SuperAdminGuard` independently validates the cryptographic signature and checks `payload.role === 'SUPER_ADMIN'`.
- If valid, the request proceeds immediately without calling `apps/api` to check permissions.

### 3. Off-Path Read-Only Database Queries
- `apps/api` uses transactional connections with tenant Row Level Security (RLS) enforcement.
- `apps/analytics` bypasses RLS using a dedicated read-only role (`analytics_ro`) to run cross-tenant aggregate metrics (`COUNT`, storage sizes, SMS usage, sync lag) without taking write locks.

### 4. Database Permissions Setup (Run Once in Supabase SQL Editor)
Run this SQL script in the Supabase Dashboard SQL Editor to create the read-only analytics role:
```sql
-- 1. Create dedicated read-only role
CREATE ROLE analytics_ro LOGIN PASSWORD '<choose-a-strong-password>';

-- 2. Grant connection and schema read access
GRANT CONNECT ON DATABASE postgres TO analytics_ro;
GRANT USAGE ON SCHEMA public TO analytics_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_ro;

-- 3. Ensure future tables created by migrations are also readable
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analytics_ro;
```

---

## 6. Docker / Self-Hosted Alternative
If you ever host on VPS/Docker instead of Vercel/Netlify:
```bash
# Build & start full stack including analytics upstream
cd infrastructure/docker
docker compose up --build -d
```
The Nginx configuration in `infrastructure/nginx/conf.d/edu-lanka.conf` mirrors the Netlify rewrites:
- `/api/` → `edu_api_upstream` (port 3001)
- `/api/analytics/` → `edu_analytics_upstream` (port 8083)

