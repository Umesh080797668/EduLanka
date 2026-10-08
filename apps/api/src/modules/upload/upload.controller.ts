import type { JwtPayload } from '@edu-lanka/shared-types';
import { Controller, Get, Post, Body, Headers, Req, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { UploadService } from './upload.service';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Get('signature')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get Cloudinary upload signature (quota enforced)' })
    @ApiQuery({ name: 'folderType', required: false, description: 'Target folder: profiles, videos, or attachments' })
    getSignature(
        @CurrentUser() user: JwtPayload,
        @Query('folderType') folderType?: string,
    ) {
        return this.uploadService.getSignature(user?.tenantId, folderType || 'profiles');
    }

    @Post('cloudinary-webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cloudinary asynchronous rendition and upload notification webhook' })
    handleCloudinaryWebhook(
        @Req() req: FastifyRequest,
        @Body() payload: any,
        @Headers() headers: Record<string, string>,
    ) {
        const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(payload));
        return this.uploadService.processCloudinaryWebhook(payload, headers, rawBody);
    }
}
