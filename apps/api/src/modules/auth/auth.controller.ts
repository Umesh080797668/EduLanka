import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Controller,
    Get,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UseGuards,
    Version,
    Patch,
    Param,
    ParseUUIDPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiOkResponse,
    ApiCreatedResponse,
    ApiBearerAuth,
    ApiNoContentResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import { CreateInquiryDto } from './dto/create-inquiry.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    // ── POST /auth/login ────────────────────────────────────────────────────────
    @Post('login')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Authenticate and receive a JWT access + refresh token pair' })
    @ApiOkResponse({ description: 'Token pair issued successfully' })
    login(@Body() dto: LoginDto) {
        const targetIdentifier = dto.identifier || dto.email || '';
        return this.authService.login(targetIdentifier, dto.password);
    }

    // ── POST /auth/signup ───────────────────────────────────────────────────────
    @Post('signup')
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new user within a tenant (SCHOOL_ADMIN / SUPER_ADMIN only)' })
    @ApiCreatedResponse({ description: 'User created and token pair issued' })
    signup(@Body() dto: SignupDto, @CurrentUser() caller: JwtPayload) {
        return this.authService.signup(dto, caller);
    }

    // ── POST /auth/self-register ───────────────────────────────────────────────
    @Post('self-register')
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new user if tenant allows self-enrollment (public)' })
    @ApiCreatedResponse({ description: 'User created and token pair issued' })
    selfRegister(@Body() dto: SignupDto) {
        return this.authService.selfRegister(dto);
    }

    // ── POST /auth/forgot-password ─────────────────────────────────────────────
    @Post('forgot-password')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Trigger a password-reset email (Supabase Auth)' })
    @ApiOkResponse({ description: 'Reset email sent (if address is registered)' })
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.email, dto.tenantId);
    }

    // ── POST /auth/reset-password ──────────────────────────────────────────────
    @Post('reset-password')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Complete a password reset using the token from the email link' })
    @ApiOkResponse({ description: 'Password updated successfully' })
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.accessToken, dto.newPassword);
    }

    // ── POST /auth/refresh ─────────────────────────────────────────────────────
    @Post('refresh')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Rotate the refresh token and receive a new token pair' })
    @ApiOkResponse({ description: 'New token pair issued' })
    refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshTokens(dto.refreshToken);
    }

    // ── POST /auth/logout ──────────────────────────────────────────────────────
    @Post('logout')
    @Version('1')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Revoke the refresh token (logout)' })
    @ApiNoContentResponse({ description: 'Logged out — refresh token revoked' })
    async logout(@CurrentUser() user: JwtPayload, @Body() dto: RefreshTokenDto) {
        await this.authService.logout(user, dto.refreshToken);
    }

    // ── POST /auth/inquiries ───────────────────────────────────────────────────
    @Post('inquiries')
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Submit an inquiry/appeal from a deactivated user account' })
    @ApiCreatedResponse({ description: 'Inquiry successfully submitted' })
    submitInquiry(@Body() dto: CreateInquiryDto) {
        return this.authService.submitInquiry(dto);
    }

    // ── GET /auth/inquiries ────────────────────────────────────────────────────
    @Get('inquiries')
    @Version('1')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List deactivation inquiries (Admins only)' })
    @ApiOkResponse({ description: 'List of inquiries' })
    getInquiries(@CurrentUser() user: JwtPayload) {
        return this.authService.getInquiries(user);
    }

    // ── PATCH /auth/inquiries/:id/status ───────────────────────────────────────
    @Patch('inquiries/:id/status')
    @Version('1')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update deactivation inquiry status (Admins only)' })
    @ApiOkResponse({ description: 'Inquiry successfully updated' })
    updateInquiryStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateInquiryStatusDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.authService.updateInquiryStatus(id, dto, user);
    }
}
