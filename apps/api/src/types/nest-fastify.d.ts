import '@nestjs/platform-fastify';
import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Declaration merging to resolve upstream NestJS type incompatibility:
 * In @nestjs/platform-fastify, NestFastifyApplication narrows enableCors to FastifyCorsOptions,
 * which structurally conflicts with INestApplication's CorsOptions under strict function types.
 * Adding this overload satisfies the `T extends INestApplication` constraint across the project.
 */
declare module '@nestjs/platform-fastify' {
    interface NestFastifyApplication {
        enableCors(options?: CorsOptions | CorsOptionsDelegate<any> | any): void;
    }
}
