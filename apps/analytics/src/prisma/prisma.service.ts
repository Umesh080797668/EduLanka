import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Super Admin Analytics Database Service (P3-S9)
 * 
 * Architectural Note:
 * Per EduLanka-Phased-Blueprint.md § 3.9, the analytics microservice performs high-performance,
 * cross-tenant read-only aggregation queries for Super Admins.
 * To avoid schema duplication, runtime CLI generation overhead, and cold-start latency,
 * this service uses direct PostgreSQL connection pooling (`pg.Pool`) while fulfilling the
 * blueprint's `PrismaService` interface contract (`query` and `writeQuery`).
 * No `schema.prisma` or `prisma generate` step is required in Docker or CI.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool!: Pool;
  private writePool!: Pool;

  onModuleInit() {
    const connectionString =
      process.env.ANALYTICS_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL;

    const writeConnectionString =
      process.env.WRITE_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      connectionString;

    if (!connectionString) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ANALYTICS_DATABASE_URL must be configured in production');
      }
      this.logger.warn(
        'ANALYTICS_DATABASE_URL not set; using local development default postgresql://localhost:54322/postgres',
      );
    }

    this.pool = new Pool({
      connectionString: connectionString || 'postgresql://localhost:54322/postgres',
      max: 10,
      idleTimeoutMillis: 30000,
    });

    this.writePool = new Pool({
      connectionString: writeConnectionString || 'postgresql://localhost:54322/postgres',
      max: 5,
      idleTimeoutMillis: 30000,
    });

    this.logger.log('Analytics read-only and write database pools initialized');
  }

  async onModuleDestroy() {
    await Promise.all([this.pool.end(), this.writePool.end()]);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows as T[];
    } finally {
      client.release();
    }
  }

  async writeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await this.writePool.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows as T[];
    } finally {
      client.release();
    }
  }
}
