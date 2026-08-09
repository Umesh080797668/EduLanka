# EduLanka Environment Setup Guide

## Architecture of Environment Variables
Due to the monorepo deployment separation, environment secrets are strictly segregated between the front-end boundaries (`apps/web`) and the privileged back-end boundary (`apps/api`). 
There is NO unified `.env` for the entire monorepo to prevent leakages across container configurations.

### 1. Web Application (`apps/web/.env.local`)
The NextJS web application purely acts as a user presentation layer interfacing directly with Supabase via browser-safe Anon keys or interacting cleanly through our Nest API gateways.
*   **Target Example File**: `apps/web/.env.example`
*   **Requires**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_API_URL`.
*   **Security Boundary**: None of these keys contain Root or Role privileges. They are safely shipped to the client DOM.

### 2. NestJS Gateway API (`apps/api/.env`)
The API handles cross-tenant administration, database migrations, RPC bindings, token validation, and password resets. These tasks require heavily provisioned Service keys.
*   **Target Example File**: `apps/api/.env.example`
*   **Requires**: `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, Redis bindings, Twilio endpoints.
*   **Security Boundary**: **MUST NEVER BE COMMITTED. MUST NEVER REACH THE CLIENT.**

### 3. Application Seeding Requirements
Running local development and staging provision setups heavily relies on establishing Super Admin credentials that bypass our strictly enforced RBAC schemas.
*   `INITIAL_SUPER_ADMIN_PASSWORD`: A mandatory environment variable within `apps/api/.env` essential for `seed-admin.ts`. Without this parameter, executing the pilot onboarding schemas will explicitly fail.

## Staging & Production Deployment (.env.staging)
During actions like `deploy-staging.yml` or manual cluster spins, ensure staging environment variables mirror the architecture structure above explicitly. Note that GitHub Secrets handle `SUPABASE_ACCESS_TOKEN` natively for Edge push configurations.
