# EduLanka — Analytics & Super Admin Service (P3-S9)

This microservice provides high-throughput, cross-tenant analytical aggregation and storage metrics for Super Admins.

## Database Access Architecture

Per `EduLanka-Phased-Blueprint.md` § 3.9, the analytics microservice queries PostgreSQL read-replicas directly:
- **Direct Connection Pooling**: Implemented via `pg.Pool` inside `PrismaService` (`src/prisma/prisma.service.ts`).
- **No Schema Duplication**: Avoids maintaining a separate `schema.prisma` alongside Supabase SQL migrations.
- **CI / Docker Build Independence**: Does not require `prisma generate` during build time (`npm run build` runs pure `nest build`).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANALYTICS_DATABASE_URL` | Read-only connection string to PostgreSQL / Supabase DB | `postgresql://localhost:54322/postgres` |
| `WRITE_DATABASE_URL` | Read-write connection string for materializing aggregations | Matches `ANALYTICS_DATABASE_URL` |
| `PORT` | Service listening port | `3002` |

## Scripts

```bash
npm run build      # Compiles NestJS application
npm run test       # Executes Jest unit tests
npm run typecheck  # Validates TypeScript types
```
