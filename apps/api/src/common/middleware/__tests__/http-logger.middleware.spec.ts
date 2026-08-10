import { HttpLoggerMiddleware } from '../http-logger.middleware';
import { Logger } from '@nestjs/common';

describe('HttpLoggerMiddleware', () => {
    let middleware: HttpLoggerMiddleware;

    beforeEach(() => {
        middleware = new HttpLoggerMiddleware();
    });

    it('should log request correctly on response finish', () => {
        const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => { });

        const mockRequest: any = {
            method: 'GET',
            originalUrl: '/api/test',
            headers: {
                'user-agent': 'Jest-Test'
            }
        };

        const mockResponse: any = {
            statusCode: 200,
            on: jest.fn((event, callback) => {
                if (event === 'finish') {
                    callback();
                }
            })
        };

        const mockNext = jest.fn();

        middleware.use(mockRequest, mockResponse, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('GET /api/test 200 - Jest-Test'));

        loggerSpy.mockRestore();
    });
});
