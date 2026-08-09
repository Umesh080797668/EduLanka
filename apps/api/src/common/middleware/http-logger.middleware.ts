import { Injectable, NestMiddleware, Logger } from '@nestjs/common';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(req: any, res: any, next: () => void): void {
        const { method, originalUrl, url } = req;
        const userAgent = req.headers['user-agent'] || '';
        const start = Date.now();

        res.on('finish', () => {
            const { statusCode } = res;
            const delay = Date.now() - start;

            this.logger.log(
                `${method} ${originalUrl || url} ${statusCode} - ${userAgent} ${delay}ms`
            );
        });

        next();
    }
}
