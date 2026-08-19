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
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
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
    async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: FastifyReply) {
        const targetIdentifier = dto.identifier || dto.email || '';
        const tokens = await this.authService.login(targetIdentifier, dto.password);

        res.header('Set-Cookie', [
            `token=${tokens.accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
            `refreshToken=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/`
        ]);

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
    @ApiCreatedResponse({ description: 'User created and token pair issued' })
    async signup(@Body() dto: SignupDto, @CurrentUser() caller: JwtPayload, @Res({ passthrough: true }) res: FastifyReply) {
        const tokens = await this.authService.signup(dto, caller);

        res.header('Set-Cookie', [
            `token=${tokens.accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
            `refreshToken=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/`
        ]);

        return tokens;
    }

    // ── POST /auth/self-register ───────────────────────────────────────────────
    @Post('self-register')
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new user if tenant allows self-enrollment (public)' })
    @ApiCreatedResponse({ description: 'User created and token pair issued' })
    async selfRegister(@Body() dto: SignupDto, @Res({ passthrough: true }) res: FastifyReply) {
        const tokens = await this.authService.selfRegister(dto);

        res.header('Set-Cookie', [
            `token=${tokens.accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
            `refreshToken=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/`
        ]);

        return tokens;
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
    async refresh(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: FastifyReply) {
        const tokens = await this.authService.refreshTokens(dto.refreshToken);

        res.header('Set-Cookie', [
            `token=${tokens.accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/`,
            `refreshToken=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/`
        ]);

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

    // ── GET /auth/tenants ──────────────────────────────────────────────────────
    @Get('tenants')
    @Version('1')
    @ApiOperation({ summary: 'List public active tenants that allow self-registration' })
    @ApiOkResponse({ description: 'Array of tenant records' })
    getPublicTenants() {
        return this.authService.getPublicTenants();
    }
}
