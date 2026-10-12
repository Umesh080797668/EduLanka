import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { MediaService } from './media.service';
import { CreateMediaAssetDto } from './dto/create-media-asset.dto';

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('media')
export class MediaController {
    constructor(private readonly mediaService: MediaService) { }

    @Get()
    @ApiOperation({ summary: 'List media assets with subject/grade filters and pagination' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'subject', required: false, type: String })
    @ApiQuery({ name: 'gradeLevel', required: false, type: Number })
    listAssets(
        @CurrentUser() user: JwtPayload,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('subject') subject?: string,
        @Query('gradeLevel') gradeLevel?: string,
    ) {
        return this.mediaService.listAssets(user, {
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            subject,
            gradeLevel: gradeLevel ? parseInt(gradeLevel, 10) : undefined,
        });
    }

    @Get('storage-usage')
    @ApiOperation({ summary: 'Get storage quota and usage breakdown (P3-S5, P3-S9)' })
    getStorageUsage(@CurrentUser() user: JwtPayload) {
        return this.mediaService.getStorageUsage(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get media asset metadata and streaming URLs' })
    getAssetById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.mediaService.getAssetById(user, id);
    }

    @Get(':id/download-manifest')
    @ApiOperation({ summary: 'Get signed offline download manifest for Growth/Institutional tenants' })
    getDownloadManifest(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.mediaService.getDownloadManifest(user, id);
    }

    @Post()
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new media asset (teachers and administrators only)' })
    createAsset(@CurrentUser() user: JwtPayload, @Body() dto: CreateMediaAssetDto) {
        return this.mediaService.createAsset(user, dto);
    }

    @Delete(':id')
    @Roles(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Soft-delete media asset and reclaim storage quota' })
    deleteAsset(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.mediaService.deleteAsset(user, id);
    }
}
