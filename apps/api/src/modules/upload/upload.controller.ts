import type { JwtPayload } from '@edu-lanka/shared-types';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // Protect this endpoint so only authenticated users can upload
@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Get('signature')
    @ApiOperation({ summary: 'Get Cloudinary upload signature' })
    getSignature(@CurrentUser() user: JwtPayload) {
        return this.uploadService.getSignature(user?.tenantId);
    }
}
