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
    Res,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiOkResponse,
    ApiCreatedResponse,
    ApiBearerAuth,
    ApiNoContentResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';

import { ConfigService } from '@nestjs/config';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';

function parseDurationToSeconds(duration: string, defaultSeconds: number): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return defaultSeconds;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: return defaultSeconds;
    }
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    private extractCookie(req: FastifyRequest, name: string): string | undefined {
        const cookieHeader = req?.headers?.cookie;
        if (!cookieHeader) return undefined;
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
        return match ? decodeURIComponent(match[1]) : undefined;
    }

    private setAuthCookies(res: FastifyReply, tokens: { accessToken: string; refreshToken: string }) {
        const isProduction = process.env.NODE_ENV === 'production';
        const secureFlag = isProduction ? 'Secure; ' : '';
        const accessTtl = parseDurationToSeconds(this.configService.get('jwt.expiresIn') ?? '15m', 900);
        const refreshTtl = parseDurationToSeconds(this.configService.get('jwt.refreshExpiresIn') ?? '7d', 604800);

        void res.header('Set-Cookie', [
            `token=${tokens.accessToken}; HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=${accessTtl}`,
            `refreshToken=${tokens.refreshToken}; HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=${refreshTtl}`,
        ]);
    }

    private clearAuthCookies(res: FastifyReply) {
        const isProduction = process.env.NODE_ENV === 'production';
        const secureFlag = isProduction ? 'Secure; ' : '';
        void res.header('Set-Cookie', [
            `token=; HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=0`,
            `refreshToken=; HttpOnly; ${secureFlag}SameSite=Lax; Path=/; Max-Age=0`,
        ]);
    }

    // ── POST /auth/login ────────────────────────────────────────────────────────
    @Post('login')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @Throttle({ short: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Authenticate and receive a JWT access + refresh token pair' })
    @ApiOkResponse({ description: 'Token pair issued successfully' })
    async login(
        @Body() dto: LoginDto,
        @Req() req: FastifyRequest,
        @Res({ passthrough: true }) res: FastifyReply,
    ) {
        const targetIdentifier = dto.identifier || dto.email || '';
        const tenantId = dto.tenantId || (req.headers['x-tenant-id'] as string | undefined)?.trim();
        const tokens = await this.authService.login(targetIdentifier, dto.password, tenantId);

        this.setAuthCookies(res, tokens);
        return tokens;
    }

    // ── POST /auth/signup ───────────────────────────────────────────────────────
    @Post('signup')
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new user within a tenant (SCHOOL_ADMIN / SUPER_ADMIN only)' })
    @ApiCreatedResponse({ description: 'User created' })
    async signup(@Body() dto: SignupDto, @CurrentUser() caller: JwtPayload) {
        return this.authService.signup(dto, caller);
    }

    // ── POST /auth/self-register ───────────────────────────────────────────────
    @Post('self-register')
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ short: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Create a new user if tenant allows self-enrollment (public)' })
    @ApiCreatedResponse({ description: 'User created and token pair issued' })
    async selfRegister(@Body() dto: SignupDto, @Res({ passthrough: true }) res: FastifyReply) {
        const tokens = await this.authService.selfRegister(dto);

        this.setAuthCookies(res, tokens);
        return tokens;
    }

    // ── POST /auth/forgot-password ─────────────────────────────────────────────
    @Post('forgot-password')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @Throttle({ short: { limit: 5, ttl: 60000 } })
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

    // ── POST /auth/change-password ─────────────────────────────────────────────
    @Post('change-password')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Change password for authenticated user' })
    @ApiOkResponse({ description: 'Password changed successfully' })
    changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtPayload) {
        return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    }

    // ── POST /auth/refresh ─────────────────────────────────────────────────────
    @Post('refresh')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Rotate the refresh token and receive a new token pair' })
    @ApiOkResponse({ description: 'New token pair issued' })
    async refresh(
        @Body() dto: RefreshTokenDto,
        @Req() req: FastifyRequest,
        @Res({ passthrough: true }) res: FastifyReply,
    ) {
        const token = dto?.refreshToken || this.extractCookie(req, 'refreshToken');
        if (!token) {
            throw new UnauthorizedException('Refresh token is required');
        }
        const tokens = await this.authService.refreshTokens(token);

        this.setAuthCookies(res, tokens);
        return tokens;
    }

    // ── POST /auth/logout ──────────────────────────────────────────────────────
    @Post('logout')
    @Version('1')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Revoke the refresh token (logout)' })
    @ApiNoContentResponse({ description: 'Logged out — refresh token revoked' })
    async logout(
        @CurrentUser() user: JwtPayload,
        @Body() dto: LogoutDto,
        @Req() req: FastifyRequest,
        @Res({ passthrough: true }) res: FastifyReply,
    ) {
        const token = dto?.refreshToken || this.extractCookie(req, 'refreshToken');
        if (token) {
            await this.authService.logout(user, token);
        }
        this.clearAuthCookies(res);
    }

    // ── POST /auth/inquiries ───────────────────────────────────────────────────
    @Post('inquiries')
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ short: { limit: 5, ttl: 60000 } })
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

    // ── GET /auth/tenants ──────────────────────────────────────────────────────
    @Get('tenants')
    @Version('1')
    @ApiOperation({ summary: 'List public active tenants that allow self-registration' })
    @ApiOkResponse({ description: 'Array of tenant records' })
    getPublicTenants() {
        return this.authService.getPublicTenants();
    }
}
