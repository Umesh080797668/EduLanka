import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    getMe(@CurrentUser() user: JwtPayload) {
        return this.usersService.getMe(user);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new user within the current tenant (admin only)' })
    create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
        return this.usersService.create(dto, user);
    }

    @Get()
    @ApiOperation({ summary: 'List all users in the current tenant (admin only)' })
    @ApiQuery({ name: 'role', required: false, description: 'Filter by role' })
    findAll(@Query('role') role: string | undefined, @CurrentUser() user: JwtPayload) {
        return this.usersService.findAll(user, role);
    }

    @Get('global-directory')
    @ApiOperation({ summary: 'List all users across all tenants (super admin only)' })
    findAllGlobal(@CurrentUser() user: JwtPayload) {
        return this.usersService.findAllGlobal(user);
    }

    @Patch('global-directory/tenant/:id/sms')
    @ApiOperation({ summary: 'Toggle SMS feature approval for a specific tenant (super admin only)' })
    toggleTenantSms(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.usersService.toggleTenantSms(id, user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a user by ID (admin only)' })
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.usersService.findOne(id, user);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a user profile (admin only)' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateUserDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.usersService.update(id, dto, user);
    }

    @Patch(':id/deactivate')
    @ApiOperation({ summary: 'Deactivate a user account (admin only)' })
    deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.usersService.setActivationStatus(id, false, user);
    }

    @Patch(':id/reactivate')
    @ApiOperation({ summary: 'Reactivate a user account (admin only)' })
    reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.usersService.setActivationStatus(id, true, user);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Hard-delete a user permanently (super admin only)' })
    remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.usersService.remove(id, user);
    }
}
