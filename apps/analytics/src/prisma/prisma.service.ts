import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool!: Pool;

  onModuleInit() {
    const connectionString =
      process.env.ANALYTICS_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL;

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

    this.logger.log('Analytics read-only database pool initialized');
  }

  async onModuleDestroy() {
    await this.pool.end();
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
}
