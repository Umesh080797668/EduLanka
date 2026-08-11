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

## 3. Vercel (Backend API)
The backend (`apps/api`) is a NestJS Fastify application.
1. Go to [Vercel](https://vercel.com) and click **Add New... > Project**.
2. Import your GitHub repository.
3. In the "Configure Project" step:
   - **Framework Preset**: Other
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm run build` or `pnpm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   - `NODE_ENV` = `production`
   - `SUPABASE_URL` = `<your-cloud-url>`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<your-service-role-key>`
   - `REDIS_URL` = `<your-upstash-redis-url>`
5. Click **Deploy**. Vercel will use the `vercel.json` we created to run the API as a Serverless Function.

> [!NOTE]
> Since the original API uses Fastify, it operates continuously. Vercel Serverless Functions have a timeout. The `vercel.json` routes all requests to Vercel's Node builder handling the Nest server.

## 4. Netlify (Frontend Web)
The frontend (`apps/web`) is a Next.js application built with a monorepo setup.
1. Go to [Netlify](https://app.netlify.com) and click **Add new site > Import an existing project**.
2. Connect to your GitHub repository.
3. In the configuration:
   - **Base directory**: `apps/web`
   - **Build command**: `npm run build` (or `pnpm run build`)
   - **Publish directory**: `.next`
4. Expand **Environment Variables** and add all necessary Next.js variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `<your-cloud-url>`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your-anon-key>`
   - `NEXT_PUBLIC_API_URL` = `https://<your-vercel-domain>.vercel.app/api/v1`
5. Click **Deploy Site**. The `netlify.toml` file at the root will automatically handle the build context and plugin setup.
