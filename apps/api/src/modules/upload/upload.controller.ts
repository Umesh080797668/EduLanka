import type { JwtPayload } from '@edu-lanka/shared-types';
import { Controller, Get, Post, Body, Headers, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

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
    @ApiOperation({ summary: 'Get Cloudinary upload signature' })
    getSignature(@CurrentUser() user: JwtPayload) {
        return this.uploadService.getSignature(user?.tenantId);
    }

    @Post('cloudinary-webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cloudinary asynchronous rendition and upload notification webhook' })
    handleCloudinaryWebhook(@Body() payload: any, @Headers() headers: Record<string, string>) {
        return this.uploadService.processCloudinaryWebhook(payload, headers);
    }
}
