import type { ApiResponse } from '@edu-lanka/shared-types';
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';


import { HttpAdapterHost } from '@nestjs/core';

/**
 * Global HTTP exception filter.
 * Transforms all thrown HttpExceptions into a consistent ApiResponse envelope.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    constructor(private readonly httpAdapterHost: HttpAdapterHost) { }

    catch(exception: HttpException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest<FastifyRequest>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        const message =
            typeof exceptionResponse === 'string'
                ? exceptionResponse
                : (exceptionResponse as Record<string, unknown>)['message'] ?? exception.message;

        const errorCode =
            typeof exceptionResponse === 'object'
                ? ((exceptionResponse as Record<string, unknown>)['error'] as string | undefined) ??
                HttpStatus[status]
                : HttpStatus[status];

        this.logger.warn(
            `[${request.method}] ${request.url} → ${status} ${String(errorCode)}`,
        );

        const body: ApiResponse<never> = {
            success: false,
            error: {
                code: String(errorCode),
                message: Array.isArray(message) ? message.join(', ') : String(message),
            },
        };

        const { httpAdapter } = this.httpAdapterHost;
        httpAdapter.reply(ctx.getResponse(), body, status);
    }
}
