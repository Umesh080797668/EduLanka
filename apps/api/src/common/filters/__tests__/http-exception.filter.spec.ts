import { HttpExceptionFilter } from '../http-exception.filter';
import { BadRequestException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Logger } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
    let filter: HttpExceptionFilter;
    let mockHttpAdapterHost: any;

    beforeEach(() => {
        mockHttpAdapterHost = {
            httpAdapter: {
                reply: jest.fn(),
            },
        };
        filter = new HttpExceptionFilter(mockHttpAdapterHost as unknown as HttpAdapterHost);
    });

    it('should format HttpExceptions into ApiResponse envelope', () => {
        const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => { });
        const mockRequest = { method: 'GET', url: '/test' };
        const mockResponse = {};

        const mockHost: any = {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => mockResponse,
            }),
        };

        const exception = new BadRequestException('Invalid payload');

        filter.catch(exception, mockHost);

        expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[GET] /test → 400 Bad Request'));
        expect(mockHttpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
            mockResponse,
            {
                success: false,
                error: {
                    code: 'Bad Request',
                    message: 'Invalid payload',
                },
            },
            400,
        );

        loggerWarnSpy.mockRestore();
    });
});
