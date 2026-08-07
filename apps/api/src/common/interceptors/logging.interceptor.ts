import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Global logging interceptor.
 * Logs incoming requests and outgoing response times.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const { method, url } = request;
        const startTime = Date.now();

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime;
                this.logger.log(`${method} ${url} — ${duration}ms`);
            }),
        );
    }
}
